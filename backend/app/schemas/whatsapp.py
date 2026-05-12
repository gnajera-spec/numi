from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Config ────────────────────────────────────────────────────────────────────

class WhatsappConfigUpdate(BaseModel):
    phone_number_id: str
    business_account_id: str
    access_token: str = Field(..., min_length=1)
    verify_token: str = Field(..., min_length=8)
    mensaje_bienvenida: str | None = Field(None, max_length=1000)
    horario_atencion: dict | None = None


class WhatsappConfigOut(BaseModel):
    id: str
    tenant_id: str
    phone_number_id: str
    business_account_id: str
    verify_token: str
    mensaje_bienvenida: str | None
    horario_atencion: dict | None
    is_active: bool
    verificado_at: datetime | None
    created_at: datetime
    updated_at: datetime


# ── Webhook payloads (Meta Cloud API) ────────────────────────────────────────

class MetaWebhookVerify(BaseModel):
    hub_mode: str = Field(..., alias="hub.mode")
    hub_verify_token: str = Field(..., alias="hub.verify_token")
    hub_challenge: str = Field(..., alias="hub.challenge")

    model_config = {"populate_by_name": True}


class InboundMessage(BaseModel):
    """Parsed inbound message after extracting from Meta webhook payload."""
    wa_message_id: str
    wa_id: str           # sender phone number (E.164 without +)
    phone_number_id: str # which WA number received it
    tipo: str            # text | interactive | document | image
    body: str | None     # text body or button reply id
    timestamp: int
    raw: dict[str, Any]


# ── Session ───────────────────────────────────────────────────────────────────

class BotSessionOut(BaseModel):
    id: str
    tenant_id: str
    user_id: str
    estado_bot: str
    contexto: dict
    ultimo_mensaje_at: datetime
    expira_at: datetime
    mensajes_count: int
