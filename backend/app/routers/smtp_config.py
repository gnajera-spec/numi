"""ABM configuración SMTP por tenant."""
from fastapi import APIRouter, Depends
from supabase._async.client import AsyncClient

from app.core.config import get_settings, Settings
from app.db.supabase import get_supabase
from app.dependencies.auth import require_role
from app.repositories.smtp_config_repository import SmtpConfigRepository
from app.schemas.smtp_config import SmtpConfigIn, SmtpConfigOut, SmtpTestResult
from app.services.smtp_service import SmtpService
from app.utils.encryption import encrypt

router = APIRouter(prefix="/admin/configuracion/smtp", tags=["smtp_config"])


def _repo(db: AsyncClient = Depends(get_supabase)) -> SmtpConfigRepository:
    return SmtpConfigRepository(db)


def _smtp_svc(
    db: AsyncClient = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> SmtpService:
    return SmtpService(SmtpConfigRepository(db), settings.encryption_key)


@router.get("", response_model=SmtpConfigOut | None)
async def get_smtp_config(
    current_user: dict = Depends(require_role("admin_empresa", "super_admin")),
    repo: SmtpConfigRepository = Depends(_repo),
):
    try:
        cfg = await repo.get_by_tenant(str(current_user["tenant_id"]))
    except Exception:
        return None
    if not cfg:
        return None
    return SmtpConfigOut.model_validate(cfg)


@router.put("", response_model=SmtpConfigOut)
async def upsert_smtp_config(
    data: SmtpConfigIn,
    current_user: dict = Depends(require_role("admin_empresa", "super_admin")),
    repo: SmtpConfigRepository = Depends(_repo),
    settings: Settings = Depends(get_settings),
):
    password_enc = (
        encrypt(data.password, settings.encryption_key)
        if settings.encryption_key and data.password
        else data.password
    )
    payload = {
        "host": data.host,
        "port": data.port,
        "username": data.username,
        "password_enc": password_enc,
        "from_email": str(data.from_email),
        "from_name": data.from_name,
        "use_tls": data.use_tls,
        "activo": data.activo,
        "use_numi_smtp": data.use_numi_smtp,
    }
    result = await repo.upsert(str(current_user["tenant_id"]), payload)
    return SmtpConfigOut.model_validate(result)


@router.post("/test", response_model=SmtpTestResult)
async def test_smtp_config(
    data: SmtpConfigIn,
    current_user: dict = Depends(require_role("admin_empresa", "super_admin")),
    smtp: SmtpService = Depends(_smtp_svc),
):
    ok, message = await smtp.test_connection(data.model_dump(), data.password)
    return SmtpTestResult(ok=ok, message=message)
