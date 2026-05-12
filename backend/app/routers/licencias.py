from uuid import UUID

from fastapi import APIRouter, Depends, Query
from supabase._async.client import AsyncClient

from app.db.supabase import get_supabase
from app.dependencies.auth import get_current_user, require_role
from app.repositories.politica_licencia_repository import PoliticaLicenciaRepository
from app.repositories.saldo_licencia_repository import SaldoLicenciaRepository
from app.repositories.solicitud_licencia_repository import SolicitudLicenciaRepository
from app.repositories.tipo_licencia_repository import TipoLicenciaRepository
from app.repositories.user_repository import UserRepository
from app.repositories.whatsapp_config_repository import WhatsappConfigRepository
from app.schemas.licencias import (
    AprobarSolicitudRequest,
    CreatePoliticaRequest,
    CreateSolicitudRequest,
    CreateTipoLicenciaRequest,
    PaginatedSolicitudes,
    PoliticaLicenciaOut,
    RechazarSolicitudRequest,
    SaldoLicenciaOut,
    SolicitudLicenciaOut,
    TipoLicenciaOut,
)
from app.services.licencia_service import LicenciaService

router = APIRouter(prefix="/licencias", tags=["licencias"])


def _get_service(db: AsyncClient = Depends(get_supabase)) -> LicenciaService:
    return LicenciaService(
        db=db,
        tipo_repo=TipoLicenciaRepository(db),
        politica_repo=PoliticaLicenciaRepository(db),
        solicitud_repo=SolicitudLicenciaRepository(db),
        saldo_repo=SaldoLicenciaRepository(db),
        user_repo=UserRepository(db),
        wa_config_repo=WhatsappConfigRepository(db),
    )


# ── Tipos de licencia ─────────────────────────────────────────────────────────

@router.get("/tipos", response_model=list[TipoLicenciaOut])
async def list_tipos(
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.list_tipos(str(current_user["tenant_id"]))


@router.post("/tipos", response_model=TipoLicenciaOut, status_code=201)
async def create_tipo(
    body: CreateTipoLicenciaRequest,
    current_user: dict = Depends(require_role("admin_empresa")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.create_tipo(str(current_user["tenant_id"]), body)


# ── Políticas ─────────────────────────────────────────────────────────────────

@router.get("/politicas", response_model=list[PoliticaLicenciaOut])
async def list_politicas(
    current_user: dict = Depends(require_role("rrhh")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.list_politicas(str(current_user["tenant_id"]))


@router.post("/politicas", response_model=PoliticaLicenciaOut, status_code=201)
async def create_politica(
    body: CreatePoliticaRequest,
    current_user: dict = Depends(require_role("admin_empresa")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.create_politica(str(current_user["tenant_id"]), body)


# ── Solicitudes ───────────────────────────────────────────────────────────────

@router.get("/solicitudes", response_model=PaginatedSolicitudes)
async def list_solicitudes(
    estado: str | None = Query(None),
    tipo_licencia_id: UUID | None = Query(None),
    user_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_role("rrhh")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.list_solicitudes(
        str(current_user["tenant_id"]),
        estado=estado,
        tipo_licencia_id=str(tipo_licencia_id) if tipo_licencia_id else None,
        user_id=str(user_id) if user_id else None,
        page=page,
        page_size=page_size,
    )


@router.post("/solicitudes", response_model=SolicitudLicenciaOut, status_code=201)
async def create_solicitud(
    body: CreateSolicitudRequest,
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.create_solicitud(current_user, body)


@router.get("/mis-solicitudes", response_model=PaginatedSolicitudes)
async def get_mis_solicitudes(
    estado: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.get_mis_solicitudes(current_user, estado=estado, page=page, page_size=page_size)


@router.get("/saldo", response_model=list[SaldoLicenciaOut])
async def get_saldo(
    anio: int | None = Query(None),
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.get_saldo(current_user, anio)


@router.get("/saldo/{user_id}", response_model=list[SaldoLicenciaOut])
async def get_saldo_user(
    user_id: UUID,
    anio: int | None = Query(None),
    current_user: dict = Depends(require_role("rrhh")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.get_saldo_user(user_id, str(current_user["tenant_id"]), anio)


@router.get("/solicitudes/{solicitud_id}", response_model=SolicitudLicenciaOut)
async def get_solicitud(
    solicitud_id: UUID,
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.get_solicitud(solicitud_id, current_user)


@router.post("/solicitudes/{solicitud_id}/aprobar", response_model=SolicitudLicenciaOut)
async def aprobar_solicitud(
    solicitud_id: UUID,
    body: AprobarSolicitudRequest,
    current_user: dict = Depends(require_role("rrhh")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.aprobar_solicitud(solicitud_id, current_user, body)


@router.post("/solicitudes/{solicitud_id}/rechazar", response_model=SolicitudLicenciaOut)
async def rechazar_solicitud(
    solicitud_id: UUID,
    body: RechazarSolicitudRequest,
    current_user: dict = Depends(require_role("rrhh")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.rechazar_solicitud(solicitud_id, current_user, body)


@router.post("/solicitudes/{solicitud_id}/cancelar", response_model=SolicitudLicenciaOut)
async def cancelar_solicitud(
    solicitud_id: UUID,
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.cancelar_solicitud(solicitud_id, current_user)
