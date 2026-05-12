import asyncio

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Query, Request, status
from fastapi.responses import PlainTextResponse
from supabase._async.client import AsyncClient

from app.core.config import Settings, get_settings
from app.db.supabase import get_supabase
from app.dependencies.auth import require_role
from app.repositories.recibo_repository import ReciboRepository
from app.repositories.user_repository import UserRepository
from app.repositories.whatsapp_config_repository import WhatsappConfigRepository
from app.repositories.whatsapp_log_repository import WhatsappLogRepository
from app.repositories.whatsapp_session_repository import WhatsappSessionRepository
from app.schemas.whatsapp import WhatsappConfigOut, WhatsappConfigUpdate
from app.services.whatsapp_service import WhatsappService

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


def _svc(
    db: AsyncClient = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> WhatsappService:
    return WhatsappService(
        db=db,
        settings=settings,
        config_repo=WhatsappConfigRepository(db),
        session_repo=WhatsappSessionRepository(db),
        log_repo=WhatsappLogRepository(db),
        user_repo=UserRepository(db),
        recibo_repo=ReciboRepository(db),
    )


# ── Config (super_admin only) ─────────────────────────────────────────────────

@router.get("/config", response_model=WhatsappConfigOut)
async def get_config(
    current_user: dict = Depends(require_role("super_admin")),
    svc: WhatsappService = Depends(_svc),
):
    return await svc.get_config(str(current_user["tenant_id"]))


@router.put("/config", response_model=WhatsappConfigOut)
async def upsert_config(
    data: WhatsappConfigUpdate,
    current_user: dict = Depends(require_role("super_admin")),
    svc: WhatsappService = Depends(_svc),
):
    return await svc.upsert_config(str(current_user["tenant_id"]), data)


# ── Webhook verification (GET) ─────────────────────────────────────────────────

@router.get("/webhook", response_class=PlainTextResponse)
async def verify_webhook(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_verify_token: str = Query(..., alias="hub.verify_token"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
    svc: WhatsappService = Depends(_svc),
):
    return svc.verify_webhook(hub_mode, hub_verify_token, hub_challenge)


# ── Webhook incoming messages (POST) ──────────────────────────────────────────

@router.post("/webhook", status_code=status.HTTP_200_OK)
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: str | None = Header(None),
    svc: WhatsappService = Depends(_svc),
):
    body = await request.body()
    svc.validate_hmac(body, x_hub_signature_256 or "")
    payload = await request.json()
    background_tasks.add_task(svc.process_webhook, payload)
    return "EVENT_RECEIVED"
