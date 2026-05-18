from uuid import UUID

from fastapi import APIRouter, Depends
from supabase._async.client import AsyncClient

from app.db.supabase import get_supabase
from app.dependencies.auth import get_current_user, require_role
from app.repositories.aprobacion_solicitud_repository import AprobacionSolicitudRepository
from app.repositories.flujo_aprobacion_repository import FlujoAprobacionRepository
from app.schemas.flujos_aprobacion import (
    FlujoAprobacionCreate,
    FlujoAprobacionOut,
    FlujoAprobacionUpdate,
    TipoLicenciaConFlujoOut,
)
from app.services.flujo_aprobacion_service import FlujoAprobacionService

router = APIRouter(prefix="/admin/flujos-aprobacion", tags=["flujos-aprobacion"])


def _get_service(db: AsyncClient = Depends(get_supabase)) -> FlujoAprobacionService:
    return FlujoAprobacionService(
        flujo_repo=FlujoAprobacionRepository(db),
        aprobacion_repo=AprobacionSolicitudRepository(db),
    )


@router.get("", response_model=list[TipoLicenciaConFlujoOut])
async def list_flujos(
    current_user: dict = Depends(require_role("admin_empresa", "rrhh")),
    svc: FlujoAprobacionService = Depends(_get_service),
):
    return await svc.list_tipos_con_flujo(str(current_user["tenant_id"]))


@router.get("/departamentos")
async def list_departamentos(
    current_user: dict = Depends(require_role("admin_empresa")),
    svc: FlujoAprobacionService = Depends(_get_service),
):
    return await svc.get_departamentos(str(current_user["tenant_id"]))


@router.get("/{flujo_id}", response_model=FlujoAprobacionOut)
async def get_flujo(
    flujo_id: UUID,
    current_user: dict = Depends(require_role("admin_empresa", "rrhh")),
    svc: FlujoAprobacionService = Depends(_get_service),
):
    return await svc.get_flujo(str(flujo_id), str(current_user["tenant_id"]))


@router.post("", response_model=FlujoAprobacionOut, status_code=201)
async def create_flujo(
    body: FlujoAprobacionCreate,
    current_user: dict = Depends(require_role("admin_empresa")),
    svc: FlujoAprobacionService = Depends(_get_service),
):
    return await svc.create_flujo(
        str(current_user["tenant_id"]), str(current_user["id"]), body
    )


@router.put("/{flujo_id}", response_model=FlujoAprobacionOut)
async def update_flujo(
    flujo_id: UUID,
    body: FlujoAprobacionUpdate,
    current_user: dict = Depends(require_role("admin_empresa")),
    svc: FlujoAprobacionService = Depends(_get_service),
):
    return await svc.update_flujo(str(flujo_id), str(current_user["tenant_id"]), body)


@router.patch("/{flujo_id}/deactivate", response_model=FlujoAprobacionOut)
async def deactivate_flujo(
    flujo_id: UUID,
    current_user: dict = Depends(require_role("admin_empresa")),
    svc: FlujoAprobacionService = Depends(_get_service),
):
    return await svc.deactivate_flujo(str(flujo_id), str(current_user["tenant_id"]))
