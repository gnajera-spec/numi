from datetime import date

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from supabase._async.client import AsyncClient

from app.core.config import Settings, get_settings
from app.db.supabase import get_supabase
from app.dependencies.auth import require_role
from app.repositories.accidente_trabajo_repository import AccidenteTrabajoRepository
from app.repositories.aptitud_laboral_repository import AptitudLaboralRepository
from app.repositories.examen_medico_repository import ExamenMedicoRepository
from app.repositories.ficha_medica_repository import FichaMedicaRepository
from app.repositories.vacunacion_repository import VacunacionRepository
from app.schemas.medico import (
    AccidenteCreate,
    AccidenteOut,
    AccidenteUpdate,
    AptitudCreate,
    AptitudOut,
    AptitudPorVencerItem,
    ExamenCreate,
    ExamenOut,
    FichaMedicaOut,
    FichaMedicaUpdate,
    PaginatedAccidentes,
    PaginatedFichas,
    ReporteAbsentismo,
    VacunacionCreate,
    VacunacionOut,
)
from app.services.medico_service import MedicoService

router = APIRouter(prefix="/medico", tags=["medico"])

_ROLES = ("servicio_medico", "admin_empresa", "super_admin")


def _get_service(
    db: AsyncClient = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> MedicoService:
    return MedicoService(
        db=db,
        settings=settings,
        fichas=FichaMedicaRepository(db),
        examenes=ExamenMedicoRepository(db),
        vacunaciones=VacunacionRepository(db),
        aptitudes=AptitudLaboralRepository(db),
        accidentes=AccidenteTrabajoRepository(db),
    )


# ── Fichas médicas ────────────────────────────────────────────────────────────

@router.get("/fichas", response_model=PaginatedFichas)
async def list_fichas(
    sede_id: str | None = Query(None),
    departamento_id: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_role(*_ROLES)),
    svc: MedicoService = Depends(_get_service),
):
    return await svc.list_fichas(
        str(current_user["tenant_id"]),
        sede_id,
        departamento_id,
        search,
        page,
        page_size,
    )


@router.get("/fichas/{user_id}", response_model=FichaMedicaOut)
async def get_ficha(
    user_id: str,
    current_user: dict = Depends(require_role(*_ROLES)),
    svc: MedicoService = Depends(_get_service),
):
    return await svc.get_ficha(user_id, str(current_user["tenant_id"]))


@router.put("/fichas/{user_id}", response_model=FichaMedicaOut)
async def upsert_ficha(
    user_id: str,
    body: FichaMedicaUpdate,
    current_user: dict = Depends(require_role(*_ROLES)),
    svc: MedicoService = Depends(_get_service),
):
    return await svc.upsert_ficha(user_id, str(current_user["tenant_id"]), body)


# ── Exámenes médicos ──────────────────────────────────────────────────────────

@router.get("/examenes/{user_id}", response_model=list[ExamenOut])
async def list_examenes(
    user_id: str,
    current_user: dict = Depends(require_role(*_ROLES)),
    svc: MedicoService = Depends(_get_service),
):
    return await svc.list_examenes(user_id, str(current_user["tenant_id"]))


@router.post(
    "/examenes/{user_id}",
    response_model=ExamenOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_examen(
    user_id: str,
    tipo: str = Query(..., pattern=r"^(ingreso|periodico|post_ausencia|egreso)$"),
    fecha: date = Query(...),
    resultado: str | None = Query(None),
    medico_responsable: str | None = Query(None),
    archivo: UploadFile | None = File(None),
    current_user: dict = Depends(require_role(*_ROLES)),
    svc: MedicoService = Depends(_get_service),
):
    body = ExamenCreate(
        tipo=tipo,
        fecha=fecha,
        resultado=resultado,
        medico_responsable=medico_responsable,
    )
    return await svc.create_examen(
        user_id,
        str(current_user["tenant_id"]),
        str(current_user["id"]),
        body,
        archivo,
    )


# ── Vacunaciones ──────────────────────────────────────────────────────────────

@router.get("/vacunaciones/{user_id}", response_model=list[VacunacionOut])
async def list_vacunaciones(
    user_id: str,
    current_user: dict = Depends(require_role(*_ROLES)),
    svc: MedicoService = Depends(_get_service),
):
    return await svc.list_vacunaciones(user_id, str(current_user["tenant_id"]))


@router.post(
    "/vacunaciones/{user_id}",
    response_model=VacunacionOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_vacunacion(
    user_id: str,
    body: VacunacionCreate,
    current_user: dict = Depends(require_role(*_ROLES)),
    svc: MedicoService = Depends(_get_service),
):
    return await svc.create_vacunacion(
        user_id,
        str(current_user["tenant_id"]),
        str(current_user["id"]),
        body,
    )


# ── Aptitudes laborales ───────────────────────────────────────────────────────

@router.get("/aptitudes/{user_id}", response_model=list[AptitudOut])
async def list_aptitudes(
    user_id: str,
    current_user: dict = Depends(require_role(*_ROLES)),
    svc: MedicoService = Depends(_get_service),
):
    return await svc.list_aptitudes(user_id, str(current_user["tenant_id"]))


@router.post(
    "/aptitudes/{user_id}",
    response_model=AptitudOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_aptitud(
    user_id: str,
    body: AptitudCreate,
    current_user: dict = Depends(require_role(*_ROLES)),
    svc: MedicoService = Depends(_get_service),
):
    return await svc.create_aptitud(
        user_id,
        str(current_user["tenant_id"]),
        str(current_user["id"]),
        body,
    )


# ── Accidentes de trabajo ─────────────────────────────────────────────────────

@router.get("/accidentes", response_model=PaginatedAccidentes)
async def list_accidentes(
    estado: str | None = Query(None, pattern=r"^(abierto|tratamiento|alta|cerrado)$"),
    user_id: str | None = Query(None),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_role(*_ROLES)),
    svc: MedicoService = Depends(_get_service),
):
    return await svc.list_accidentes(
        str(current_user["tenant_id"]),
        estado,
        user_id,
        desde.isoformat() if desde else None,
        hasta.isoformat() if hasta else None,
        page,
        page_size,
    )


@router.post("/accidentes", response_model=AccidenteOut, status_code=status.HTTP_201_CREATED)
async def create_accidente(
    body: AccidenteCreate,
    current_user: dict = Depends(require_role(*_ROLES)),
    svc: MedicoService = Depends(_get_service),
):
    return await svc.create_accidente(
        str(current_user["tenant_id"]),
        str(current_user["id"]),
        body,
    )


@router.patch("/accidentes/{id}", response_model=AccidenteOut)
async def update_accidente(
    id: str,
    body: AccidenteUpdate,
    current_user: dict = Depends(require_role(*_ROLES)),
    svc: MedicoService = Depends(_get_service),
):
    return await svc.update_accidente(id, str(current_user["tenant_id"]), body)


# ── Reportes ──────────────────────────────────────────────────────────────────

@router.get("/reportes/absentismo", response_model=ReporteAbsentismo)
async def reporte_absentismo(
    desde: date = Query(...),
    hasta: date = Query(...),
    departamento_id: str | None = Query(None),
    current_user: dict = Depends(require_role(*_ROLES)),
    svc: MedicoService = Depends(_get_service),
):
    return await svc.reporte_absentismo(
        str(current_user["tenant_id"]), desde, hasta, departamento_id
    )


@router.get("/reportes/aptitudes-por-vencer", response_model=list[AptitudPorVencerItem])
async def reporte_aptitudes_por_vencer(
    dias: int = Query(30, ge=1, le=365),
    sede_id: str | None = Query(None),
    departamento_id: str | None = Query(None),
    current_user: dict = Depends(require_role(*_ROLES)),
    svc: MedicoService = Depends(_get_service),
):
    return await svc.reporte_aptitudes_por_vencer(
        str(current_user["tenant_id"]), dias, sede_id, departamento_id
    )
