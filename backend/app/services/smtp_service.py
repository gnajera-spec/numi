"""Servicio de email usando la configuración SMTP del tenant."""
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.repositories.smtp_config_repository import SmtpConfigRepository
from app.utils.encryption import decrypt


class SmtpService:
    def __init__(self, smtp_repo: SmtpConfigRepository, encryption_key: str) -> None:
        self._repo = smtp_repo
        self._key = encryption_key

    async def get_config(self, tenant_id: str) -> dict | None:
        cfg = await self._repo.get_by_tenant(tenant_id)
        if not cfg or not cfg.get("activo"):
            return None
        return cfg

    async def send_invitation(self, tenant_id: str, to_email: str, link: str, tenant_nombre: str) -> bool:
        """Envía email de invitación. Retorna True si se envió, False si no hay SMTP configurado."""
        cfg = await self.get_config(tenant_id)
        if not cfg:
            return False

        subject = f"Invitación a {tenant_nombre} en NUMI"
        html = f"""
        <div style="font-family:sans-serif;max-width:600px;margin:auto">
          <h2 style="color:#e87d50">¡Bienvenido/a a NUMI!</h2>
          <p>Fuiste invitado/a a unirte a <strong>{tenant_nombre}</strong> en la plataforma NUMI.</p>
          <p>Hacé clic en el siguiente enlace para completar tu registro:</p>
          <a href="{link}" style="display:inline-block;padding:12px 24px;background:#e87d50;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">
            Completar registro
          </a>
          <p style="color:#888;font-size:12px;margin-top:24px">
            Este enlace expira en 7 días. Si no esperabas esta invitación, ignorá este mensaje.
          </p>
        </div>
        """
        return await self._send(cfg, to_email, subject, html)

    async def test_connection(self, cfg_in: dict, password_plain: str) -> tuple[bool, str]:
        """Test de conexión SMTP con credenciales en texto plano."""
        try:
            if cfg_in.get("use_tls"):
                context = ssl.create_default_context()
                with smtplib.SMTP(cfg_in["host"], cfg_in["port"], timeout=10) as s:
                    s.starttls(context=context)
                    s.login(cfg_in["username"], password_plain)
            else:
                with smtplib.SMTP_SSL(cfg_in["host"], cfg_in["port"], timeout=10) as s:
                    s.login(cfg_in["username"], password_plain)
            return True, "Conexión exitosa"
        except smtplib.SMTPAuthenticationError:
            return False, "Error de autenticación: usuario o contraseña incorrectos"
        except smtplib.SMTPConnectError:
            return False, "No se pudo conectar al servidor SMTP"
        except Exception as e:
            return False, f"Error: {str(e)}"

    async def _send(self, cfg: dict, to_email: str, subject: str, html: str) -> bool:
        try:
            password = decrypt(cfg["password_enc"], self._key) if self._key else cfg.get("password_enc", "")

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{cfg['from_name']} <{cfg['from_email']}>"
            msg["To"] = to_email
            msg.attach(MIMEText(html, "html"))

            if cfg.get("use_tls"):
                context = ssl.create_default_context()
                with smtplib.SMTP(cfg["host"], cfg["port"], timeout=15) as s:
                    s.starttls(context=context)
                    s.login(cfg["username"], password)
                    s.sendmail(cfg["from_email"], to_email, msg.as_string())
            else:
                with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=15) as s:
                    s.login(cfg["username"], password)
                    s.sendmail(cfg["from_email"], to_email, msg.as_string())
            return True
        except Exception:
            return False
