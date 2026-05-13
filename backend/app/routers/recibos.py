from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from supabase._async.client import AsyncClient

from app.db.supabase import get_supabase
from app.dependencies.auth import get_current_user, require_role
from app.repositories.periodo_repository import PeriodoRepository
from app.repositories.recibo_repository import ReciboRepository
from app.repositories.upload_job_repository import UploadJobRepository
from app.repositories.user_repository import UserRepository
from app.repositories.whatsapp_config_repository import WhatsappConfigRepository
from app.schemas.recibos import (
    ConfirmResponse,
    CreatePeriodoRequest,
    FirmarRequest,
    PaginatedDashboard,
    PaginatedPeriodos,
    PaginatedRecibos,
    PeriodoOut,
    ReciboOut,
    RenotificarRequest,
    UploadResponse,
)
from app.services.recibo_service import ReciboService

router = APIRouter(tags=["recibos"])


def _svc(db: AsyncClient = Depends(get_supabase)) -> ReciboService:
    return ReciboService(
        db,
        PeriodoRepository(db),
        ReciboRepository(db),
        UserRepository(db),
        WhatsappConfigRepository(db),
        UploadJobRepository(db),
    )


# ── Períodos ──────────────────────────────────────────────────────────────────

@router.get("/periodos", response_model=PaginatedPeriodos)
async def list_periodos(
    estado: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    svc: ReciboService = Depends(_svc),
):
    return await svc.list_periodos(
        str(current_user["tenant_id"]), estado=estado, page=page, page_size=page_size
    )


@router.post("/periodos", response_model=PeriodoOut, status_code=status.HTTP_201_CREATED)
async def create_periodo(
    data: CreatePeriodoRequest,
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    svc: ReciboService = Depends(_svc),
):
    return await svc.create_periodo(str(current_user["tenant_id"]), current_user["id"], data)


@router.post("/periodos/{periodo_id}/upload", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_recibos(
    periodo_id: UUID,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    svc: ReciboService = Depends(_svc),
):
    return await svc.upload_recibos(str(periodo_id), str(current_user["tenant_id"]), file)


@router.post(
    "/periodos/{periodo_id}/upload/{job_id}/confirm",
    response_model=ConfirmResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def confirm_upload(
    periodo_id: UUID,
    job_id: str,
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    svc: ReciboService = Depends(_svc),
):
    return await svc.confirm_upload(str(periodo_id), str(current_user["tenant_id"]), job_id)


@router.get("/periodos/{periodo_id}/recibos", response_model=PaginatedDashboard)
async def get_periodo_recibos(
    periodo_id: UUID,
    estado: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    svc: ReciboService = Depends(_svc),
):
    return await svc.get_periodo_recibos(
        str(periodo_id),
        str(current_user["tenant_id"]),
        estado=estado,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.post("/periodos/{periodo_id}/renotificar", status_code=status.HTTP_202_ACCEPTED)
async def renotificar(
    periodo_id: UUID,
    data: RenotificarRequest = RenotificarRequest(),
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    svc: ReciboService = Depends(_svc),
):
    return await svc.renotificar(str(periodo_id), str(current_user["tenant_id"]), data)


# ── Recibos ───────────────────────────────────────────────────────────────────

# /recibos/export MUST come before /recibos/{id} to avoid routing conflict
@router.get("/recibos/export")
async def export_recibos_csv(
    periodo_id: UUID = Query(...),
    estado: str | None = Query(None),
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    svc: ReciboService = Depends(_svc),
):
    return await svc.export_csv(str(periodo_id), str(current_user["tenant_id"]), estado)


@router.get("/recibos", response_model=PaginatedRecibos)
async def get_my_recibos(
    estado: str | None = Query(None),
    periodo: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    svc: ReciboService = Depends(_svc),
):
    return await svc.get_my_recibos(
        current_user["id"], estado=estado, periodo=periodo, page=page, page_size=page_size
    )


@router.get("/recibos/{recibo_id}", response_model=ReciboOut)
async def get_recibo(
    recibo_id: UUID,
    request: Request,
    current_user: dict = Depends(get_current_user),
    svc: ReciboService = Depends(_svc),
):
    return await svc.get_recibo(recibo_id, current_user)


@router.post("/recibos/{recibo_id}/firmar", response_model=ReciboOut)
async def firmar_recibo(
    recibo_id: UUID,
    data: FirmarRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    svc: ReciboService = Depends(_svc),
):
    return await svc.firmar_recibo(recibo_id, current_user, data, request)
