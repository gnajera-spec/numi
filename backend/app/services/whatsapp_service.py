"""
WhatsApp bot service: webhook verification, HMAC validation, FSM dispatcher,
Meta API message sending, and outbound notifications.

FSM states (Phase 3 + Phase 4 + Phase 5):
  idle / menu_principal    → recibos_ver (1), licencias_tipo (2), comunicaciones_ver (3), idle (0/salir)
  recibos_ver              → recibos_confirmar (VER + pending receipt found)
  recibos_confirmar        → idle (CONFIRMO → registers firma)
  licencias_tipo           → licencias_fechas (user selects license type)
  licencias_fechas         → licencias_confirmar (user provides dates)
  licencias_confirmar      → idle (CONFIRMO → creates solicitud)
  licencias_saldo          → idle (shows balance, returns to menu)
  comunicaciones_ver       → comunicaciones_confirmar (if requiere_confirmacion)
  comunicaciones_confirmar → idle (LEÍDO → marks confirmado)
"""
import hashlib
import hmac
import logging
from datetime import date, datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException, status
from supabase._async.client import AsyncClient

from app.core.config import Settings
from app.repositories.comunicacion_destinatario_repository import ComunicacionDestinatarioRepository
from app.repositories.comunicacion_repository import ComunicacionRepository
from app.repositories.recibo_repository import ReciboRepository
from app.repositories.saldo_licencia_repository import SaldoLicenciaRepository
from app.repositories.solicitud_licencia_repository import SolicitudLicenciaRepository
from app.repositories.tipo_licencia_repository import TipoLicenciaRepository
from app.repositories.user_repository import UserRepository
from app.repositories.whatsapp_config_repository import WhatsappConfigRepository
from app.repositories.whatsapp_log_repository import WhatsappLogRepository
from app.repositories.whatsapp_session_repository import WhatsappSessionRepository
from app.schemas.whatsapp import InboundMessage, WhatsappConfigOut, WhatsappConfigUpdate
from app.services.licencia_service import LicenciaService, _calc_dias_habiles
from app.services.meta_api import MetaApiClient
from app.utils.encryption import decrypt, encrypt

logger = logging.getLogger(__name__)

# ── Text normalisation ────────────────────────────────────────────────────────

_KEYWORDS_VER           = {"ver", "veer", "vel"}
_KEYWORDS_CONFIRMO      = {"confirmo", "confirme", "confermo", "si", "sí"}
_KEYWORDS_LEIDO         = {"leido", "leído", "lei", "confirmo", "confirme", "si", "sí"}
_KEYWORDS_SALIR         = {"salir", "cancelar", "cancel", "menu", "menú", "0"}
_KEYWORDS_RECIBOS       = {"1", "recibo", "recibos", "sueldo", "recibir"}
_KEYWORDS_LICENCIAS     = {"2", "licencia", "licencias", "vacacion", "vacaciones", "permiso"}
_KEYWORDS_COMUNICACIONES = {"3", "comunicacion", "comunicaciones", "aviso", "avisos", "notificacion"}
_KEYWORDS_SALDO         = {"saldo", "dias", "días", "balance", "disponible"}


def _normalize(text: str | None) -> str:
    return (text or "").strip().lower()


def _parse_date(text: str) -> date | None:
    """Parse DD/MM/YYYY or YYYY-MM-DD date strings."""
    text = text.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


# ── Menu text helpers ─────────────────────────────────────────────────────────

_MENU = (
    "📋 *Menú principal*\n\n"
    "1️⃣ Recibos de sueldo\n"
    "2️⃣ Licencias\n"
    "3️⃣ Comunicaciones\n"
    "0️⃣ Salir\n\n"
    "_Respondé el número de la opción._"
)

_UNKNOWN = (
    "No entendí tu mensaje. Respondé *MENU* para ver las opciones disponibles."
)


# ── WhatsApp Service ──────────────────────────────────────────────────────────

class WhatsappService:
    def __init__(
        self,
        db: AsyncClient,
        settings: Settings,
        config_repo: WhatsappConfigRepository,
        session_repo: WhatsappSessionRepository,
        log_repo: WhatsappLogRepository,
        user_repo: UserRepository,
        recibo_repo: ReciboRepository,
        tipo_licencia_repo: TipoLicenciaRepository | None = None,
        solicitud_repo: SolicitudLicenciaRepository | None = None,
        saldo_repo: SaldoLicenciaRepository | None = None,
        comunicacion_repo: ComunicacionRepository | None = None,
        comunicacion_dest_repo: ComunicacionDestinatarioRepository | None = None,
    ) -> None:
        self._db = db
        self._settings = settings
        self._configs = config_repo
        self._sessions = session_repo
        self._logs = log_repo
        self._users = user_repo
        self._recibos = recibo_repo
        self._tipos_licencia = tipo_licencia_repo
        self._solicitudes = solicitud_repo
        self._saldos = saldo_repo
        self._comunicaciones = comunicacion_repo
        self._com_destinatarios = comunicacion_dest_repo

    # ── Config management ─────────────────────────────────────────────────────

    async def get_config(self, tenant_id: str) -> WhatsappConfigOut:
        cfg = await self._configs.get_by_tenant(tenant_id)
        if not cfg:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Configuración WA no encontrada")
        return self._to_config_out(cfg)

    async def upsert_config(self, tenant_id: str, data: WhatsappConfigUpdate) -> WhatsappConfigOut:
        if not self._settings.encryption_key:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "ENCRYPTION_KEY no configurada")
        encrypted = encrypt(data.access_token, self._settings.encryption_key)
        payload = {
            "phone_number_id": data.phone_number_id,
            "business_account_id": data.business_account_id,
            "access_token_encrypted": encrypted,
            "verify_token": data.verify_token,
            "mensaje_bienvenida": data.mensaje_bienvenida,
            "horario_atencion": data.horario_atencion,
        }
        cfg = await self._configs.upsert(tenant_id, payload)
        return self._to_config_out(cfg)

    def _to_config_out(self, cfg: dict) -> WhatsappConfigOut:
        return WhatsappConfigOut(
            id=str(cfg["id"]),
            tenant_id=str(cfg["tenant_id"]),
            phone_number_id=cfg["phone_number_id"],
            business_account_id=cfg["business_account_id"],
            verify_token=cfg["verify_token"],
            mensaje_bienvenida=cfg.get("mensaje_bienvenida"),
            horario_atencion=cfg.get("horario_atencion"),
            is_active=cfg["is_active"],
            verificado_at=cfg.get("verificado_at"),
            created_at=cfg["created_at"],
            updated_at=cfg["updated_at"],
        )

    # ── Webhook verification (GET) ────────────────────────────────────────────

    def verify_webhook(self, mode: str, token: str, challenge: str) -> str:
        if mode != "subscribe":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "hub.mode inválido")
        if token != self._settings.meta_verify_token:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "hub.verify_token inválido")
        return challenge

    # ── Webhook processing (POST) ─────────────────────────────────────────────

    def validate_hmac(self, body: bytes, signature_header: str) -> None:
        """Raises 403 if HMAC-SHA256 signature from Meta doesn't match."""
        if not self._settings.meta_app_secret:
            return  # skip in dev/test when secret is not configured
        expected = "sha256=" + hmac.new(
            self._settings.meta_app_secret.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature_header or ""):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Firma HMAC inválida")

    async def process_webhook(self, payload: dict[str, Any]) -> None:
        """Entry point for incoming Meta webhook events. Runs async in background."""
        try:
            for entry in payload.get("entry", []):
                for change in entry.get("changes", []):
                    if change.get("field") != "messages":
                        continue
                    value = change.get("value", {})
                    phone_number_id = value.get("metadata", {}).get("phone_number_id", "")
                    messages = value.get("messages", [])
                    contacts = value.get("contacts", [])
                    for msg in messages:
                        inbound = self._parse_message(msg, phone_number_id, contacts)
                        await self._dispatch(inbound)
        except Exception as exc:
            logger.exception("Error processing WhatsApp webhook: %s", exc)

    def _parse_message(self, msg: dict, phone_number_id: str, contacts: list) -> InboundMessage:
        tipo = msg.get("type", "text")
        body: str | None = None
        if tipo == "text":
            body = msg.get("text", {}).get("body")
        elif tipo == "interactive":
            reply = msg.get("interactive", {})
            body = (
                reply.get("button_reply", {}).get("id")
                or reply.get("list_reply", {}).get("id")
            )
        return InboundMessage(
            wa_message_id=msg["id"],
            wa_id=msg["from"],
            phone_number_id=phone_number_id,
            tipo=tipo,
            body=body,
            timestamp=int(msg.get("timestamp", 0)),
            raw=msg,
        )

    async def _dispatch(self, msg: InboundMessage) -> None:
        # Reject stale messages (>5 min old)
        age = datetime.now(timezone.utc).timestamp() - msg.timestamp
        if age > 300:
            logger.warning("Stale WhatsApp message ignored: %s", msg.wa_message_id)
            return

        cfg = await self._configs.get_by_phone_number_id(msg.phone_number_id)
        if not cfg or not cfg["is_active"]:
            logger.warning("No active WA config for phone_number_id %s", msg.phone_number_id)
            return

        tenant_id = str(cfg["tenant_id"])

        # Map wa_id → user (whatsapp_id_encrypted lookup is deferred — search by wa_id directly for now)
        user = await self._users.get_by_wa_id(msg.wa_id, tenant_id)
        if not user:
            logger.info("Unknown wa_id %s for tenant %s", msg.wa_id, tenant_id)
            return

        user_id = str(user["id"])
        access_token = decrypt(cfg["access_token_encrypted"], self._settings.encryption_key)
        client = MetaApiClient(cfg["phone_number_id"], access_token)

        await self._logs.log(
            tenant_id=tenant_id,
            user_id=user_id,
            direction="inbound",
            tipo=msg.tipo,
            wa_message_id=msg.wa_message_id,
            contenido=msg.body,
            metadata=msg.raw,
        )

        session = await self._sessions.get(tenant_id, user_id)
        if session and await self._sessions.is_expired(session):
            session = await self._sessions.reset(tenant_id, user_id)

        current_state = session["estado_bot"] if session else "idle"
        contexto = session.get("contexto", {}) if session else {}

        await self._sessions.increment_count(tenant_id, user_id)
        await self._handle_state(current_state, contexto, msg, user, tenant_id, client)

    async def _handle_state(
        self,
        state: str,
        contexto: dict,
        msg: InboundMessage,
        user: dict,
        tenant_id: str,
        client: MetaApiClient,
    ) -> None:
        user_id = str(user["id"])
        kw = _normalize(msg.body)

        if state == "idle" or state == "menu_principal":
            if kw in _KEYWORDS_RECIBOS or kw in _KEYWORDS_VER:
                await self._enter_recibos_ver(user_id, tenant_id, msg.wa_id, contexto, client)
            elif kw in _KEYWORDS_LICENCIAS:
                await self._enter_licencias_tipo(user_id, tenant_id, msg.wa_id, client)
            elif kw in _KEYWORDS_COMUNICACIONES:
                await self._enter_comunicaciones_ver(user_id, tenant_id, msg.wa_id, client)
            elif kw in _KEYWORDS_SALDO:
                await self._show_licencias_saldo(user_id, tenant_id, msg.wa_id, client)
            elif kw in _KEYWORDS_SALIR and state == "menu_principal":
                await self._sessions.reset(tenant_id, user_id)
                await self._send_text(client, msg.wa_id, "Hasta luego 👋")
                await self._log_outbound(tenant_id, user_id, "text", "Hasta luego 👋")
            else:
                await self._sessions.upsert(tenant_id, user_id, "menu_principal", {})
                await self._send_text(client, msg.wa_id, _MENU)
                await self._log_outbound(tenant_id, user_id, "text", _MENU)

        elif state == "recibos_ver":
            if kw in _KEYWORDS_CONFIRMO:
                await self._confirm_firma(user_id, tenant_id, msg.wa_id, contexto, client)
            elif kw in _KEYWORDS_SALIR:
                await self._sessions.upsert(tenant_id, user_id, "menu_principal", {})
                await self._send_text(client, msg.wa_id, _MENU)
                await self._log_outbound(tenant_id, user_id, "text", _MENU)
            else:
                # re-send the receipt link
                await self._enter_recibos_ver(user_id, tenant_id, msg.wa_id, contexto, client)

        elif state == "recibos_confirmar":
            if kw in _KEYWORDS_CONFIRMO:
                await self._confirm_firma(user_id, tenant_id, msg.wa_id, contexto, client)
            elif kw in _KEYWORDS_SALIR:
                await self._sessions.upsert(tenant_id, user_id, "menu_principal", {})
                await self._send_text(client, msg.wa_id, _MENU)
                await self._log_outbound(tenant_id, user_id, "text", _MENU)
            else:
                hint = "Respondé *CONFIRMO* para firmar el recibo o *SALIR* para volver al menú."
                await self._send_text(client, msg.wa_id, hint)
                await self._log_outbound(tenant_id, user_id, "text", hint)

        elif state == "licencias_tipo":
            await self._handle_licencias_tipo(user_id, tenant_id, msg.wa_id, contexto, kw, client)

        elif state == "licencias_fechas":
            await self._handle_licencias_fechas(user_id, tenant_id, msg.wa_id, contexto, msg.body or "", client)

        elif state == "licencias_confirmar":
            if kw in _KEYWORDS_CONFIRMO:
                await self._confirm_licencia(user_id, tenant_id, msg.wa_id, contexto, client)
            elif kw in _KEYWORDS_SALIR:
                await self._sessions.reset(tenant_id, user_id)
                await self._send_text(client, msg.wa_id, "Solicitud cancelada. " + _MENU)
                await self._log_outbound(tenant_id, user_id, "text", "Solicitud cancelada.")
            else:
                hint = "Respondé *CONFIRMO* para enviar la solicitud o *CANCELAR* para anular."
                await self._send_text(client, msg.wa_id, hint)
                await self._log_outbound(tenant_id, user_id, "text", hint)

        elif state == "licencias_saldo":
            await self._show_licencias_saldo(user_id, tenant_id, msg.wa_id, client)

        elif state == "comunicaciones_ver":
            if kw in _KEYWORDS_SALIR:
                await self._sessions.upsert(tenant_id, user_id, "menu_principal", {})
                await self._send_text(client, msg.wa_id, _MENU)
                await self._log_outbound(tenant_id, user_id, "text", _MENU)
            else:
                await self._enter_comunicaciones_ver(user_id, tenant_id, msg.wa_id, client)

        elif state == "comunicaciones_confirmar":
            if kw in _KEYWORDS_LEIDO:
                await self._confirm_comunicacion(user_id, tenant_id, msg.wa_id, contexto, client)
            elif kw in _KEYWORDS_SALIR:
                await self._sessions.upsert(tenant_id, user_id, "menu_principal", {})
                await self._send_text(client, msg.wa_id, _MENU)
                await self._log_outbound(tenant_id, user_id, "text", _MENU)
            else:
                hint = "Respondé *LEÍDO* para confirmar la lectura o *SALIR* para volver al menú."
                await self._send_text(client, msg.wa_id, hint)
                await self._log_outbound(tenant_id, user_id, "text", hint)

        else:
            # Unknown/unsupported state — reset to menu
            await self._sessions.upsert(tenant_id, user_id, "menu_principal", {})
            await self._send_text(client, msg.wa_id, _MENU)
            await self._log_outbound(tenant_id, user_id, "text", _MENU)

    # ── Licencias FSM ─────────────────────────────────────────────────────────

    async def _enter_licencias_tipo(
        self, user_id: str, tenant_id: str, wa_id: str, client: MetaApiClient
    ) -> None:
        if not self._tipos_licencia:
            await self._send_text(client, wa_id, "Módulo de licencias no disponible aún.")
            await self._sessions.reset(tenant_id, user_id)
            return

        tipos = await self._tipos_licencia.list(tenant_id)
        if not tipos:
            await self._send_text(client, wa_id, "No hay tipos de licencia configurados.")
            await self._sessions.reset(tenant_id, user_id)
            return

        lines = ["📋 *Tipos de licencia*\n"]
        for i, t in enumerate(tipos[:8], 1):
            cert = " 📄" if t.get("requiere_certificado") else ""
            lines.append(f"{i}️⃣ {t['nombre']}{cert}")
        lines.append("\n_Respondé el número del tipo o *CANCELAR* para volver._")

        text = "\n".join(lines)
        ctx = {"tipos": [{"id": str(t["id"]), "nombre": t["nombre"], "requiere_certificado": t.get("requiere_certificado", False)} for t in tipos[:8]]}
        await self._sessions.upsert(tenant_id, user_id, "licencias_tipo", ctx)
        await self._send_text(client, wa_id, text)
        await self._log_outbound(tenant_id, user_id, "text", text)

    async def _handle_licencias_tipo(
        self, user_id: str, tenant_id: str, wa_id: str, contexto: dict, kw: str, client: MetaApiClient
    ) -> None:
        if kw in _KEYWORDS_SALIR:
            await self._sessions.upsert(tenant_id, user_id, "menu_principal", {})
            await self._send_text(client, wa_id, _MENU)
            return

        tipos = contexto.get("tipos", [])
        try:
            idx = int(kw) - 1
            if idx < 0 or idx >= len(tipos):
                raise ValueError
        except (ValueError, TypeError):
            hint = f"Respondé un número del 1 al {len(tipos)} para seleccionar el tipo."
            await self._send_text(client, wa_id, hint)
            return

        tipo = tipos[idx]
        new_ctx = {
            "tipos": tipos,
            "tipo_licencia_id": tipo["id"],
            "tipo_licencia_nombre": tipo["nombre"],
            "requiere_certificado": tipo.get("requiere_certificado", False),
        }
        await self._sessions.upsert(tenant_id, user_id, "licencias_fechas", new_ctx)

        ask = (
            f"Seleccionaste: *{tipo['nombre']}*\n\n"
            "¿Cuáles son las fechas?\n"
            "Ingresá *inicio* y *fin* en formato DD/MM/YYYY separadas por un espacio o guion.\n"
            "_Ej: 15/06/2026 20/06/2026_\n\n"
            "Respondé *CANCELAR* para volver."
        )
        await self._send_text(client, wa_id, ask)
        await self._log_outbound(tenant_id, user_id, "text", ask)

    async def _handle_licencias_fechas(
        self, user_id: str, tenant_id: str, wa_id: str, contexto: dict, raw: str, client: MetaApiClient
    ) -> None:
        if _normalize(raw) in _KEYWORDS_SALIR:
            await self._sessions.upsert(tenant_id, user_id, "menu_principal", {})
            await self._send_text(client, wa_id, _MENU)
            return

        parts = raw.replace(" - ", " ").replace("-", " ").split()
        fecha_inicio = _parse_date(parts[0]) if len(parts) >= 1 else None
        fecha_fin = _parse_date(parts[1]) if len(parts) >= 2 else fecha_inicio

        if not fecha_inicio or not fecha_fin:
            hint = "No entendí las fechas. Ingresalas como DD/MM/YYYY DD/MM/YYYY (ej: 15/06/2026 20/06/2026)."
            await self._send_text(client, wa_id, hint)
            return

        if fecha_fin < fecha_inicio:
            await self._send_text(client, wa_id, "La fecha de fin no puede ser anterior a la de inicio.")
            return

        dias = _calc_dias_habiles(fecha_inicio, fecha_fin)
        tipo_nombre = contexto.get("tipo_licencia_nombre", "")

        new_ctx = {**contexto, "fecha_inicio": str(fecha_inicio), "fecha_fin": str(fecha_fin), "dias_habiles": dias}
        await self._sessions.upsert(tenant_id, user_id, "licencias_confirmar", new_ctx)

        summary = (
            f"📋 *Resumen de solicitud*\n\n"
            f"Tipo: {tipo_nombre}\n"
            f"Desde: {fecha_inicio.strftime('%d/%m/%Y')}\n"
            f"Hasta: {fecha_fin.strftime('%d/%m/%Y')}\n"
            f"Días hábiles: {dias}\n\n"
            "Respondé *CONFIRMO* para enviar la solicitud o *CANCELAR* para anular."
        )
        await self._send_text(client, wa_id, summary)
        await self._log_outbound(tenant_id, user_id, "text", summary)

    async def _confirm_licencia(
        self, user_id: str, tenant_id: str, wa_id: str, contexto: dict, client: MetaApiClient
    ) -> None:
        if not self._solicitudes:
            await self._send_text(client, wa_id, "No se pudo crear la solicitud.")
            await self._sessions.reset(tenant_id, user_id)
            return

        tipo_id = contexto.get("tipo_licencia_id")
        fecha_inicio_str = contexto.get("fecha_inicio")
        fecha_fin_str = contexto.get("fecha_fin")

        if not tipo_id or not fecha_inicio_str or not fecha_fin_str:
            await self._send_text(client, wa_id, "Sesión expirada. Iniciá el proceso de nuevo.")
            await self._sessions.reset(tenant_id, user_id)
            return

        try:
            fecha_inicio = date.fromisoformat(fecha_inicio_str)
            fecha_fin = date.fromisoformat(fecha_fin_str)
            dias = _calc_dias_habiles(fecha_inicio, fecha_fin)

            row = await self._solicitudes.create({
                "tenant_id": tenant_id,
                "user_id": user_id,
                "tipo_licencia_id": tipo_id,
                "fecha_inicio": fecha_inicio,
                "fecha_fin": fecha_fin,
                "dias_habiles": dias,
                "estado": "pendiente",
                "canal": "whatsapp",
            })

            if self._saldos:
                await self._saldos.add_pendientes(tenant_id, user_id, tipo_id, fecha_inicio.year, dias)

            numero = row.get("numero_solicitud", "")
            ok_text = (
                f"✅ Solicitud enviada correctamente.\n"
                f"Número: *{numero}*\n\n"
                "Te avisaremos cuando RRHH la revise."
            )
            await self._send_text(client, wa_id, ok_text)
            await self._log_outbound(tenant_id, user_id, "text", ok_text)

        except Exception as exc:
            logger.error("Error creating licencia from bot for user %s: %s", user_id, exc)
            await self._send_text(client, wa_id, "Ocurrió un error al crear la solicitud. Intentá de nuevo.")

        await self._sessions.reset(tenant_id, user_id)

    async def _show_licencias_saldo(
        self, user_id: str, tenant_id: str, wa_id: str, client: MetaApiClient
    ) -> None:
        if not self._saldos:
            await self._send_text(client, wa_id, "Consulta de saldo no disponible.")
            await self._sessions.reset(tenant_id, user_id)
            return

        anio = datetime.now(timezone.utc).year
        rows = await self._saldos.list_for_user(tenant_id, user_id, anio)

        if not rows:
            msg_text = f"No tenés saldos registrados para {anio}. Consultá con RRHH."
        else:
            lines = [f"📊 *Tu saldo de licencias {anio}*\n"]
            for r in rows:
                tipo = r.get("tipos_licencia") or {}
                disponibles = r["dias_disponibles"]
                tomados = r["dias_tomados"]
                pendientes = r["dias_pendientes"]
                restantes = max(0, disponibles - tomados - pendientes)
                lines.append(
                    f"▸ {tipo.get('nombre', r['tipo_licencia_id'])}: "
                    f"{restantes} disponibles ({tomados} tomados, {pendientes} pendientes)"
                )
            msg_text = "\n".join(lines)

        await self._send_text(client, wa_id, msg_text)
        await self._log_outbound(tenant_id, user_id, "text", msg_text)
        await self._sessions.reset(tenant_id, user_id)

    # ── Recibos FSM ───────────────────────────────────────────────────────────

    async def _enter_recibos_ver(
        self,
        user_id: str,
        tenant_id: str,
        wa_id: str,
        contexto: dict,
        client: MetaApiClient,
    ) -> None:
        recibo_id = contexto.get("recibo_id")
        recibo = await self._recibos.get_by_id_for_user(recibo_id, user_id) if recibo_id else None

        if not recibo:
            # Find the most recent unsigned receipt
            recibo = await self._recibos.get_latest_unsigned(user_id, tenant_id)

        if not recibo:
            msg_text = "No tenés recibos pendientes de firma 📭"
            await self._send_text(client, wa_id, msg_text)
            await self._log_outbound(tenant_id, user_id, "text", msg_text)
            await self._sessions.reset(tenant_id, user_id)
            return

        recibo_id = str(recibo["id"])
        signed_url = await self._get_signed_url(recibo["storage_path"])

        periodo = recibo.get("periodos_liquidacion") or {}
        descripcion = periodo.get("descripcion") or periodo.get("periodo", "")

        await self._sessions.upsert(
            tenant_id, user_id, "recibos_confirmar", {"recibo_id": recibo_id}
        )

        # Mark as viewed
        await self._recibos.mark_visto(recibo_id)

        doc_caption = f"Recibo de sueldo — {descripcion}\n\nRespondé *CONFIRMO* para firmarlo o *SALIR* para cancelar."
        await client.send_document(wa_id, signed_url, f"recibo_{descripcion}.pdf", doc_caption)
        await self._log_outbound(tenant_id, user_id, "document", doc_caption)

    async def _confirm_firma(
        self,
        user_id: str,
        tenant_id: str,
        wa_id: str,
        contexto: dict,
        client: MetaApiClient,
    ) -> None:
        recibo_id = contexto.get("recibo_id")
        if not recibo_id:
            await self._send_text(client, wa_id, _UNKNOWN)
            await self._sessions.reset(tenant_id, user_id)
            return

        recibo = await self._recibos.get_by_id_for_user(recibo_id, user_id)
        if not recibo:
            await self._send_text(client, wa_id, "No encontré el recibo. Intentá de nuevo.")
            await self._sessions.reset(tenant_id, user_id)
            return

        if recibo.get("estado") == "firmado":
            await self._send_text(client, wa_id, "Este recibo ya fue firmado anteriormente ✅")
            await self._sessions.reset(tenant_id, user_id)
            return

        import hashlib as _hl
        from datetime import datetime, timezone as _tz
        archivo_hash = recibo.get("archivo_hash", "")
        wa_session_hash = _hl.sha256(f"{user_id}:{recibo_id}:{wa_id}".encode()).hexdigest()

        await self._recibos.create_firma({
            "recibo_id": recibo_id,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "canal": "whatsapp",
            "archivo_hash": archivo_hash,
            "wa_session_hash": wa_session_hash,
            "timestamp_firma": datetime.now(_tz.utc).isoformat(),
        })
        await self._recibos.update_estado(recibo_id, "firmado")

        ok_text = "✅ Recibo firmado correctamente. ¡Gracias!"
        await self._send_text(client, wa_id, ok_text)
        await self._log_outbound(tenant_id, user_id, "text", ok_text)
        await self._sessions.reset(tenant_id, user_id)

    # ── Comunicaciones FSM ────────────────────────────────────────────────────

    async def _enter_comunicaciones_ver(
        self,
        user_id: str,
        tenant_id: str,
        wa_id: str,
        client: MetaApiClient,
    ) -> None:
        if not self._com_destinatarios:
            await self._send_text(client, wa_id, "Módulo de comunicaciones no disponible.")
            await self._sessions.reset(tenant_id, user_id)
            return

        rows, total = await self._com_destinatarios.list_by_user(
            user_id, estado_filter="no_leidas", offset=0, limit=5
        )
        if not rows:
            msg_text = "No tenés comunicaciones pendientes de lectura 📭"
            await self._send_text(client, wa_id, msg_text)
            await self._log_outbound(tenant_id, user_id, "text", msg_text)
            await self._sessions.reset(tenant_id, user_id)
            return

        dest = rows[0]
        com = dest.get("comunicaciones") or {}
        com_id = str(com.get("id", ""))
        asunto = com.get("asunto", "")
        cuerpo = com.get("cuerpo", "")
        requiere = com.get("requiere_confirmacion", False)

        await self._com_destinatarios.mark_leido(com_id, user_id)

        texto = f"📢 *{asunto}*\n\n{cuerpo}"
        if total > 1:
            texto += f"\n\n_({total - 1} comunicaciones más pendientes)_"

        if requiere:
            texto += "\n\nRespondé *LEÍDO* para confirmar la lectura."
            await self._sessions.upsert(
                tenant_id, user_id, "comunicaciones_confirmar", {"comunicacion_id": com_id}
            )
        else:
            await self._sessions.reset(tenant_id, user_id)

        await self._send_text(client, wa_id, texto)
        await self._log_outbound(tenant_id, user_id, "text", texto)

    async def _confirm_comunicacion(
        self,
        user_id: str,
        tenant_id: str,
        wa_id: str,
        contexto: dict,
        client: MetaApiClient,
    ) -> None:
        com_id = contexto.get("comunicacion_id")
        if not com_id or not self._com_destinatarios:
            await self._send_text(client, wa_id, _UNKNOWN)
            await self._sessions.reset(tenant_id, user_id)
            return

        await self._com_destinatarios.mark_confirmado(com_id, user_id)

        ok_text = "✅ Confirmación registrada. ¡Gracias!"
        await self._send_text(client, wa_id, ok_text)
        await self._log_outbound(tenant_id, user_id, "text", ok_text)
        await self._sessions.reset(tenant_id, user_id)

    # ── Outbound notifications ─────────────────────────────────────────────────

    async def notify_recibo(
        self,
        *,
        tenant_id: str,
        user_id: str,
        wa_id: str,
        nombre: str,
        periodo: str,
        recibo_id: str,
        cfg: dict,
    ) -> bool:
        """Send HSM notification for a new receipt. Returns True on success."""
        try:
            access_token = decrypt(cfg["access_token_encrypted"], self._settings.encryption_key)
            client = MetaApiClient(cfg["phone_number_id"], access_token)
            components = [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": nombre},
                        {"type": "text", "text": periodo},
                    ],
                }
            ]
            await client.send_template(wa_id, "nuevo_recibo_disponible", components)
            # Pre-load session context so user's "VER" reply is immediately handled
            await self._sessions.upsert(tenant_id, user_id, "recibos_ver", {"recibo_id": recibo_id})
            await self._logs.log(
                tenant_id=tenant_id,
                user_id=user_id,
                direction="outbound",
                tipo="template",
                template_name="nuevo_recibo_disponible",
                contenido=f"{nombre} | {periodo}",
            )
            return True
        except httpx.HTTPStatusError as exc:
            logger.error("Meta API error notifying recibo %s: %s", recibo_id, exc)
            return False
        except Exception as exc:
            logger.error("Error notifying recibo %s: %s", recibo_id, exc)
            return False

    async def send_activation_link(
        self,
        *,
        tenant_id: str,
        user_id: str,
        wa_id: str,
        nombre: str,
        activation_url: str,
        cfg: dict,
    ) -> bool:
        """Send HSM with activation link to a new collaborator."""
        try:
            access_token = decrypt(cfg["access_token_encrypted"], self._settings.encryption_key)
            client = MetaApiClient(cfg["phone_number_id"], access_token)
            components = [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": nombre},
                        {"type": "text", "text": activation_url},
                    ],
                }
            ]
            await client.send_template(wa_id, "invitacion_activacion", components)
            await self._logs.log(
                tenant_id=tenant_id,
                user_id=user_id,
                direction="outbound",
                tipo="template",
                template_name="invitacion_activacion",
            )
            return True
        except Exception as exc:
            logger.error("Error sending activation link to %s: %s", user_id, exc)
            return False

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _get_signed_url(self, storage_path: str) -> str:
        r = await self._db.storage.from_("recibos").create_signed_url(storage_path, 86400)
        return r["signedURL"]

    async def _send_text(self, client: MetaApiClient, wa_id: str, text: str) -> None:
        try:
            await client.send_text(wa_id, text)
        except Exception as exc:
            logger.error("Failed to send text to %s: %s", wa_id, exc)

    async def _log_outbound(
        self, tenant_id: str, user_id: str, tipo: str, contenido: str | None = None,
        template_name: str | None = None,
    ) -> None:
        await self._logs.log(
            tenant_id=tenant_id,
            user_id=user_id,
            direction="outbound",
            tipo=tipo,
            contenido=contenido,
            template_name=template_name,
        )
