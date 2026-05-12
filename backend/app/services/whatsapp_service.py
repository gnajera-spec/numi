"""
WhatsApp bot service: webhook verification, HMAC validation, FSM dispatcher,
Meta API message sending, and outbound notifications.

FSM states implemented in Phase 3:
  idle            → menu_principal (any message)
  menu_principal  → recibos_ver (1/recibos/ver), idle (0/salir)
  recibos_ver     → recibos_confirmar (VER + pending receipt found)
  recibos_confirmar → idle (CONFIRMO → registers firma)

All other states: reply with menu hint.
"""
import hashlib
import hmac
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException, status
from supabase._async.client import AsyncClient

from app.core.config import Settings
from app.repositories.recibo_repository import ReciboRepository
from app.repositories.user_repository import UserRepository
from app.repositories.whatsapp_config_repository import WhatsappConfigRepository
from app.repositories.whatsapp_log_repository import WhatsappLogRepository
from app.repositories.whatsapp_session_repository import WhatsappSessionRepository
from app.schemas.whatsapp import InboundMessage, WhatsappConfigOut, WhatsappConfigUpdate
from app.services.meta_api import MetaApiClient
from app.utils.encryption import decrypt, encrypt

logger = logging.getLogger(__name__)

# ── Text normalisation ────────────────────────────────────────────────────────

_KEYWORDS_VER      = {"ver", "veer", "vel"}
_KEYWORDS_CONFIRMO = {"confirmo", "confirme", "confermo", "si", "sí"}
_KEYWORDS_SALIR    = {"salir", "cancelar", "cancel", "menu", "menú", "0"}
_KEYWORDS_RECIBOS  = {"1", "recibo", "recibos", "sueldo", "recibir"}

def _normalize(text: str | None) -> str:
    return (text or "").strip().lower()


# ── Menu text helpers ─────────────────────────────────────────────────────────

_MENU = (
    "📋 *Menú principal*\n\n"
    "1️⃣ Recibos de sueldo\n"
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
    ) -> None:
        self._db = db
        self._settings = settings
        self._configs = config_repo
        self._sessions = session_repo
        self._logs = log_repo
        self._users = user_repo
        self._recibos = recibo_repo

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

        else:
            # Unknown/unsupported state — reset to menu
            await self._sessions.upsert(tenant_id, user_id, "menu_principal", {})
            await self._send_text(client, msg.wa_id, _MENU)
            await self._log_outbound(tenant_id, user_id, "text", _MENU)

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
