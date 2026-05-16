"""Router para invitaciones de colaboradores y onboarding público."""
import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from supabase._async.client import AsyncClient

from app.core.config import get_settings, Settings
from app.db.supabase import get_supabase
from app.dependencies.auth import require_role
from app.repositories.invitacion_repository import InvitacionRepository
from app.repositories.tenant_repository import TenantRepository
from app.repositories.user_repository import UserRepository
from app.schemas.invitaciones import (
    CompletarOnboardingRequest,
    InvitacionCreada,
    InvitarIndividualRequest,
    InvitarLoteRequest,
    LoteResultado,
    OnboardingTokenInfo,
)
from app.services.invitacion_service import InvitacionService
from app.services.smtp_service import SmtpService
from app.repositories.smtp_config_repository import SmtpConfigRepository

router = APIRouter(tags=["invitaciones"])


def _svc(
    db: AsyncClient = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> InvitacionService:
    return InvitacionService(
        InvitacionRepository(db),
        UserRepository(db),
        TenantRepository(db),
        frontend_url=getattr(settings, "frontend_url", "http://localhost:5580"),
    )


def _smtp_svc(
    db: AsyncClient = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> SmtpService:
    return SmtpService(SmtpConfigRepository(db), settings.encryption_key)


# ── Invitar individual ────────────────────────────────────────────────────────

@router.post("/admin/invitaciones/individual", response_model=InvitacionCreada, status_code=status.HTTP_201_CREATED)
async def invitar_individual(
    data: InvitarIndividualRequest,
    current_user: dict = Depends(require_role("admin_empresa", "rrhh", "super_admin")),
    svc: InvitacionService = Depends(_svc),
    smtp: SmtpService = Depends(_smtp_svc),
):
    resultado = await svc.invitar_individual(
        str(current_user["tenant_id"]), str(current_user["id"]), data
    )
    # Enviar email si hay SMTP configurado (best-effort, no bloquea la respuesta)
    try:
        tenant_info = await svc._tenants.get(str(current_user["tenant_id"]))
        tenant_nombre = (tenant_info or {}).get("nombre", "")
        await smtp.send_invitation(str(current_user["tenant_id"]), str(data.email), resultado.link, tenant_nombre)
    except Exception:
        pass
    return resultado


# ── Invitar por lote (JSON) ───────────────────────────────────────────────────

@router.post("/admin/invitaciones/lote", response_model=LoteResultado, status_code=status.HTTP_201_CREATED)
async def invitar_lote(
    data: InvitarLoteRequest,
    current_user: dict = Depends(require_role("admin_empresa", "rrhh", "super_admin")),
    svc: InvitacionService = Depends(_svc),
    smtp: SmtpService = Depends(_smtp_svc),
):
    resultado = await svc.invitar_lote(
        str(current_user["tenant_id"]), str(current_user["id"]), data.colaboradores
    )
    # Enviar emails best-effort
    try:
        for inv in resultado.exitosos:
            await smtp.send_invitation(str(current_user["tenant_id"]), inv.email, inv.link, "")
    except Exception:
        pass
    return resultado


# ── Invitar por lote (CSV upload) ────────────────────────────────────────────

@router.post("/admin/invitaciones/lote/csv", response_model=LoteResultado, status_code=status.HTTP_201_CREATED)
async def invitar_lote_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role("admin_empresa", "rrhh", "super_admin")),
    svc: InvitacionService = Depends(_svc),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El archivo debe ser un CSV")
    content = await file.read()
    items = InvitacionService.parse_csv(content)
    if not items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El CSV no contiene filas válidas (columnas: cuil, email)")
    return await svc.invitar_lote(str(current_user["tenant_id"]), str(current_user["id"]), items)


# ── Onboarding público ────────────────────────────────────────────────────────

@router.get("/onboarding/{token}", response_model=OnboardingTokenInfo)
async def get_onboarding_info(
    token: str,
    svc: InvitacionService = Depends(_svc),
):
    return await svc.get_token_info(token)


@router.post("/onboarding/{token}/completar", status_code=status.HTTP_201_CREATED)
async def completar_onboarding(
    token: str,
    data: CompletarOnboardingRequest,
    svc: InvitacionService = Depends(_svc),
):
    return await svc.completar_onboarding(token, data)
