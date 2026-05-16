from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from supabase._async.client import AsyncClient

from app.db.supabase import get_supabase
from app.dependencies.auth import get_current_user, require_role
from app.repositories.comunicacion_adjunto_repository import ComunicacionAdjuntoRepository
from app.repositories.comunicacion_destinatario_repository import ComunicacionDestinatarioRepository
from app.repositories.comunicacion_repository import ComunicacionRepository
from app.repositories.user_repository import UserRepository
from app.repositories.whatsapp_config_repository import WhatsappConfigRepository
from app.schemas.comunicaciones import (
    AdjuntoOut,
    ConfirmarResponse,
    LeerResponse,
    ComunicacionCreate,
    ComunicacionOut,
    DestinatarioOut,
    EnviarResponse,
    PaginatedComunicaciones,
    PaginatedComunicacionesColaborador,
    ReenviarResponse,
)
from app.services.comunicacion_service import ComunicacionService

router = APIRouter(prefix="/comunicaciones", tags=["comunicaciones"])


def _get_service(db: AsyncClient = Depends(get_supabase)) -> ComunicacionService:
    return ComunicacionService(
        db=db,
        comunicaciones=ComunicacionRepository(db),
        destinatarios=ComunicacionDestinatarioRepository(db),
        adjuntos=ComunicacionAdjuntoRepository(db),
        users=UserRepository(db),
        wa_config=WhatsappConfigRepository(db),
    )


# ── RRHH: listar ─────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedComunicaciones)
async def list_comunicaciones(
    estado: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_role("rrhh", "admin", "super_admin")),
    svc: ComunicacionService = Depends(_get_service),
):
    return await svc.list_by_tenant(
        str(current_user["tenant_id"]), estado, page, page_size
    )


# ── RRHH: crear ──────────────────────────────────────────────────────────────

@router.post("", response_model=ComunicacionOut, status_code=status.HTTP_201_CREATED)
async def create_comunicacion(
    body: ComunicacionCreate,
    current_user: dict = Depends(require_role("rrhh", "admin", "super_admin")),
    svc: ComunicacionService = Depends(_get_service),
):
    return await svc.create(
        str(current_user["tenant_id"]), str(current_user["id"]), body
    )


# ── Colaborador: mis comunicaciones ──────────────────────────────────────────
# NOTE: must be declared BEFORE /{id} to avoid routing conflict

@router.get("/colaborador", response_model=PaginatedComunicacionesColaborador)
async def list_comunicaciones_colaborador(
    estado: str | None = Query(None, pattern="^(todas|no_leidas|confirmadas)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    svc: ComunicacionService = Depends(_get_service),
):
    return await svc.list_for_colaborador(
        str(current_user["id"]), estado, page, page_size
    )


# ── RRHH: detalle ────────────────────────────────────────────────────────────

@router.get("/{id}", response_model=ComunicacionOut)
async def get_comunicacion(
    id: str,
    current_user: dict = Depends(require_role("rrhh", "admin", "super_admin")),
    svc: ComunicacionService = Depends(_get_service),
):
    return await svc.get(str(current_user["tenant_id"]), id)


# ── RRHH: destinatarios (seguimiento) ────────────────────────────────────────

@router.get("/{id}/destinatarios", response_model=list[DestinatarioOut])
async def list_destinatarios(
    id: str,
    current_user: dict = Depends(require_role("rrhh", "admin", "super_admin")),
    svc: ComunicacionService = Depends(_get_service),
):
    return await svc.list_destinatarios(str(current_user["tenant_id"]), id)


# ── RRHH: adjuntar archivo ────────────────────────────────────────────────────

@router.post("/{id}/adjuntos", response_model=AdjuntoOut, status_code=status.HTTP_201_CREATED)
async def add_adjunto(
    id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role("rrhh", "admin", "super_admin")),
    svc: ComunicacionService = Depends(_get_service),
):
    return await svc.add_adjunto(str(current_user["tenant_id"]), id, file)


# ── RRHH: enviar ─────────────────────────────────────────────────────────────

@router.post("/{id}/enviar", response_model=EnviarResponse, status_code=status.HTTP_202_ACCEPTED)
async def enviar_comunicacion(
    id: str,
    current_user: dict = Depends(require_role("rrhh", "admin", "super_admin")),
    svc: ComunicacionService = Depends(_get_service),
):
    return await svc.enviar(str(current_user["tenant_id"]), id)


# ── RRHH: reenviar ───────────────────────────────────────────────────────────

@router.post("/{id}/reenviar", response_model=ReenviarResponse, status_code=status.HTTP_202_ACCEPTED)
async def reenviar_comunicacion(
    id: str,
    current_user: dict = Depends(require_role("rrhh", "admin", "super_admin")),
    svc: ComunicacionService = Depends(_get_service),
):
    return await svc.reenviar(str(current_user["tenant_id"]), id)


# ── Colaborador: marcar como leído ───────────────────────────────────────────

@router.post("/{id}/leer", response_model=LeerResponse)
async def leer_comunicacion(
    id: str,
    current_user: dict = Depends(get_current_user),
    svc: ComunicacionService = Depends(_get_service),
):
    leido_at = await svc.marcar_leido(id, str(current_user["id"]))
    return LeerResponse(leido_at=leido_at)


# ── Colaborador: confirmar lectura ────────────────────────────────────────────────

@router.post("/{id}/confirmar", response_model=ConfirmarResponse)
async def confirmar_comunicacion(
    id: str,
    current_user: dict = Depends(get_current_user),
    svc: ComunicacionService = Depends(_get_service),
):
    confirmed_at = await svc.confirmar(id, str(current_user["id"]))
    return ConfirmarResponse(confirmado_at=confirmed_at)
