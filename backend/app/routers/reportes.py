from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from supabase._async.client import AsyncClient

from app.db.supabase import get_supabase
from app.dependencies.auth import require_role
from app.repositories.reportes_repository import ReportesRepository
from app.schemas.reportes import (
    DashboardKPIs,
    HeadcountDistribucion,
    TendenciaLicencias,
)
from app.services.reporte_service import ReporteService

router = APIRouter(prefix="/reportes", tags=["reportes"])

_ROLES = ("rrhh", "admin_empresa", "super_admin")


def _get_service(db: AsyncClient = Depends(get_supabase)) -> ReporteService:
    return ReporteService(repo=ReportesRepository(db))


@router.get("/dashboard", response_model=DashboardKPIs)
async def get_dashboard(
    current_user: dict = Depends(require_role(*_ROLES)),
    service: ReporteService = Depends(_get_service),
) -> DashboardKPIs:
    return await service.get_dashboard_kpis(current_user["tenant_id"])


@router.get("/headcount", response_model=HeadcountDistribucion)
async def get_headcount(
    current_user: dict = Depends(require_role(*_ROLES)),
    service: ReporteService = Depends(_get_service),
) -> HeadcountDistribucion:
    return await service.get_headcount_distribucion(current_user["tenant_id"])


@router.get("/licencias", response_model=TendenciaLicencias)
async def get_tendencia_licencias(
    meses: int = Query(default=6, ge=1, le=24),
    current_user: dict = Depends(require_role(*_ROLES)),
    service: ReporteService = Depends(_get_service),
) -> TendenciaLicencias:
    return await service.get_tendencia_licencias(current_user["tenant_id"], meses)


@router.get("/export/licencias")
async def export_licencias(
    desde: date | None = Query(default=None),
    hasta: date | None = Query(default=None),
    estado: str | None = Query(default=None, pattern=r"^(pendiente|aprobada|rechazada|cancelada)$"),
    current_user: dict = Depends(require_role(*_ROLES)),
    service: ReporteService = Depends(_get_service),
) -> StreamingResponse:
    csv_content = await service.export_licencias_csv(
        current_user["tenant_id"],
        desde.isoformat() if desde else None,
        hasta.isoformat() if hasta else None,
        estado,
    )
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=licencias.csv"},
    )


@router.get("/export/comunicaciones")
async def export_comunicaciones(
    desde: date | None = Query(default=None),
    hasta: date | None = Query(default=None),
    current_user: dict = Depends(require_role(*_ROLES)),
    service: ReporteService = Depends(_get_service),
) -> StreamingResponse:
    csv_content = await service.export_comunicaciones_csv(
        current_user["tenant_id"],
        desde.isoformat() if desde else None,
        hasta.isoformat() if hasta else None,
    )
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=comunicaciones.csv"},
    )
