from uuid import UUID

from fastapi import APIRouter, Depends, Form, Query, UploadFile, status
from fastapi import HTTPException
from supabase._async.client import AsyncClient

from app.core.config import get_settings, Settings
from app.db.supabase import get_supabase
from app.dependencies.auth import get_current_user, require_role
from app.repositories.colaborador_documento_repository import ColaboradorDocumentoRepository
from app.repositories.colaborador_repository import ColaboradorRepository
from app.repositories.token_repository import TokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.users import (
    BajaRequest,
    ColaboradorDocumentoOut,
    CreateUserRequest,
    HorarioOut,
    HorarioRequest,
    InviteResponse,
    PaginatedUsers,
    SetRolesRequest,
    SuspendRequest,
    UpdateOwnProfileRequest,
    UpdateUserRequest,
    UserDetail,
)
from app.schemas.user import UserSummary
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


def _svc(
    db: AsyncClient = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> UserService:
    return UserService(
        UserRepository(db),
        TokenRepository(db),
        ColaboradorRepository(db),
        encryption_key=settings.encryption_key,
    )


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedUsers)
async def list_users(
    role: str | None = Query(None),
    estado: str | None = Query(None),
    sede_id: UUID | None = Query(None),
    departamento_id: UUID | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    svc: UserService = Depends(_svc),
):
    return await svc.list_users(
        str(current_user["tenant_id"]),
        role=role,
        estado=estado,
        sede_id=str(sede_id) if sede_id else None,
        departamento_id=str(departamento_id) if departamento_id else None,
        search=search,
        page=page,
        page_size=page_size,
    )


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=UserDetail, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: CreateUserRequest,
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    svc: UserService = Depends(_svc),
):
    return await svc.create_user(str(current_user["tenant_id"]), current_user["id"], data)


# ── Get by ID ─────────────────────────────────────────────────────────────────

@router.get("/{user_id}", response_model=UserDetail)
async def get_user(
    user_id: UUID,
    current_user: dict = Depends(get_current_user),
    svc: UserService = Depends(_svc),
):
    return await svc.get_user(user_id, current_user)


# ── Update (rrhh+) ────────────────────────────────────────────────────────────

@router.patch("/{user_id}", response_model=UserDetail)
async def update_user(
    user_id: UUID,
    data: UpdateUserRequest,
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    svc: UserService = Depends(_svc),
):
    return await svc.update_user(user_id, data, current_user)


# ── Update own profile (collaborator) — deshabilitado: colaboradores no actualizan sus datos
# El endpoint se mantiene pero restringido a RRHH+

@router.patch("/{user_id}/profile", response_model=UserDetail)
async def update_own_profile(
    user_id: UUID,
    data: UpdateOwnProfileRequest,
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    svc: UserService = Depends(_svc),
):
    return await svc.update_user(user_id, data, current_user)


# ── Invite ────────────────────────────────────────────────────────────────────

@router.post("/{user_id}/invite", response_model=InviteResponse)
async def invite_user(
    user_id: UUID,
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    svc: UserService = Depends(_svc),
):
    return await svc.invite_user(user_id, current_user["id"], str(current_user["tenant_id"]))


# ── Lifecycle ─────────────────────────────────────────────────────────────────

@router.post("/{user_id}/suspend", status_code=status.HTTP_204_NO_CONTENT)
async def suspend_user(
    user_id: UUID,
    _data: SuspendRequest = SuspendRequest(),
    current_user: dict = Depends(require_role("admin_empresa", "super_admin")),
    svc: UserService = Depends(_svc),
):
    await svc.suspend_user(user_id, str(current_user["tenant_id"]))


@router.post("/{user_id}/reactivate", response_model=UserDetail)
async def reactivate_user(
    user_id: UUID,
    current_user: dict = Depends(require_role("admin_empresa", "super_admin")),
    svc: UserService = Depends(_svc),
):
    return await svc.reactivate_user(user_id, str(current_user["tenant_id"]))


@router.patch("/{user_id}/roles", response_model=UserSummary)
async def set_user_roles(
    user_id: UUID,
    data: SetRolesRequest,
    current_user: dict = Depends(require_role("admin_empresa", "super_admin")),
    svc: UserService = Depends(_svc),
):
    return await svc.set_user_roles(user_id, data, current_user)


@router.post("/{user_id}/baja", status_code=status.HTTP_204_NO_CONTENT)
async def baja_user(
    user_id: UUID,
    data: BajaRequest = BajaRequest(),
    current_user: dict = Depends(require_role("admin_empresa", "super_admin")),
    svc: UserService = Depends(_svc),
):
    await svc.baja_user(user_id, str(current_user["tenant_id"]), data)


# ── Horario laboral ───────────────────────────────────────────────────────────

@router.get("/{user_id}/horarios", response_model=list[HorarioOut])
async def get_horarios(
    user_id: UUID,
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    db: AsyncClient = Depends(get_supabase),
):
    repo = ColaboradorRepository(db)
    return await repo.get_horarios(str(user_id))


@router.put("/{user_id}/horarios", response_model=list[HorarioOut])
async def save_horarios(
    user_id: UUID,
    data: HorarioRequest,
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    db: AsyncClient = Depends(get_supabase),
):
    target = await UserRepository(db).get_by_id(str(user_id))
    if not target or str(target["tenant_id"]) != str(current_user["tenant_id"]):
        raise HTTPException(status_code=403, detail="Acceso no autorizado")
    for h in data.horarios:
        if h.hora_fin <= h.hora_inicio:
            raise HTTPException(status_code=422, detail=f"Día {h.dia_semana}: hora_fin debe ser posterior a hora_inicio")
    repo = ColaboradorRepository(db)
    return await repo.upsert_horarios(
        str(user_id),
        str(current_user["tenant_id"]),
        [h.model_dump() for h in data.horarios],
    )


# ── Colaborador documentos ────────────────────────────────────────────────────

_ALLOWED_TIPOS = {"cv", "titulo", "certificado", "contrato", "otro"}
_MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.get("/{user_id}/documentos", response_model=list[ColaboradorDocumentoOut])
async def list_documentos(
    user_id: UUID,
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    db: AsyncClient = Depends(get_supabase),
):
    repo = ColaboradorDocumentoRepository(db)
    return await repo.list_by_user(str(user_id), str(current_user["tenant_id"]))


@router.post("/{user_id}/documentos", response_model=ColaboradorDocumentoOut, status_code=status.HTTP_201_CREATED)
async def upload_documento(
    user_id: UUID,
    file: UploadFile,
    tipo: str = Form(...),
    descripcion: str | None = Form(None),
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    db: AsyncClient = Depends(get_supabase),
):
    if tipo not in _ALLOWED_TIPOS:
        raise HTTPException(status_code=422, detail=f"tipo debe ser uno de: {', '.join(sorted(_ALLOWED_TIPOS))}")
    content = await file.read()
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(status_code=422, detail="El archivo no puede superar los 20 MB")
    repo = ColaboradorDocumentoRepository(db)
    return await repo.upload_and_create(
        db,
        str(user_id),
        str(current_user["tenant_id"]),
        str(current_user["id"]),
        tipo,
        descripcion,
        file.filename or "documento",
        content,
        file.content_type or "application/octet-stream",
    )


@router.delete("/{user_id}/documentos/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_documento(
    user_id: UUID,
    doc_id: UUID,
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    db: AsyncClient = Depends(get_supabase),
):
    target = await UserRepository(db).get_by_id(str(user_id))
    if not target or str(target["tenant_id"]) != str(current_user["tenant_id"]):
        raise HTTPException(status_code=403, detail="Acceso no autorizado")
    repo = ColaboradorDocumentoRepository(db)
    await repo.delete(str(doc_id), str(user_id), str(current_user["tenant_id"]))
