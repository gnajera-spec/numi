from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from supabase._async.client import AsyncClient

from app.db.supabase import get_supabase
from app.dependencies.auth import get_current_user, require_role
from app.repositories.colaborador_repository import ColaboradorRepository
from app.repositories.token_repository import TokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.users import (
    BajaRequest,
    CreateUserRequest,
    InviteResponse,
    PaginatedUsers,
    SuspendRequest,
    UpdateOwnProfileRequest,
    UpdateUserRequest,
    UserDetail,
)
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


def _svc(db: AsyncClient = Depends(get_supabase)) -> UserService:
    return UserService(UserRepository(db), TokenRepository(db), ColaboradorRepository(db))


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


# ── Update own profile (collaborator) ─────────────────────────────────────────

@router.patch("/{user_id}/profile", response_model=UserDetail)
async def update_own_profile(
    user_id: UUID,
    data: UpdateOwnProfileRequest,
    current_user: dict = Depends(get_current_user),
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


@router.post("/{user_id}/baja", status_code=status.HTTP_204_NO_CONTENT)
async def baja_user(
    user_id: UUID,
    data: BajaRequest = BajaRequest(),
    current_user: dict = Depends(require_role("admin_empresa", "super_admin")),
    svc: UserService = Depends(_svc),
):
    await svc.baja_user(user_id, str(current_user["tenant_id"]), data)
