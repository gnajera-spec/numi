from uuid import UUID

from fastapi import APIRouter, Depends, Query
from supabase._async.client import AsyncClient

from app.db.supabase import get_supabase
from app.dependencies.auth import require_role
from app.repositories.convenio_repository import ConvenioRepository
from app.repositories.departamento_repository import DepartamentoRepository
from app.repositories.puesto_repository import PuestoRepository
from app.repositories.sede_repository import SedeRepository
from app.repositories.tenant_repository import TenantRepository
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserSummary
from app.schemas.tenants import (
    ConvenioCreate,
    ConvenioOut,
    DepartamentoCreate,
    DepartamentoOut,
    DepartamentoUpdate,
    PaginatedPuestos,
    PaginatedSedes,
    PaginatedTenants,
    PuestoCreate,
    PuestoOut,
    PuestoUpdate,
    SedeCreate,
    SedeOut,
    SedeUpdate,
    SetRolesRequest,
    TenantBrandingUpdate,
    TenantCreate,
    TenantCreateResponse,
    TenantOut,
    TenantUpdate,
)
from app.services.tenant_service import TenantService

from pydantic import BaseModel

class SetAdminRequest(BaseModel):
    role: str = "admin_empresa"  # permite también rrhh, colaborador, etc.

router = APIRouter(tags=["tenants"])


def _get_service(db: AsyncClient = Depends(get_supabase)) -> TenantService:
    return TenantService(
        tenants=TenantRepository(db),
        sedes=SedeRepository(db),
        deptos=DepartamentoRepository(db),
        puestos=PuestoRepository(db),
        convenios=ConvenioRepository(db),
        users=UserRepository(db),
    )


# ── Tenants (super_admin) ─────────────────────────────────────────────────────

@router.get("/tenants", response_model=PaginatedTenants)
async def list_tenants(
    estado: str | None = Query(default=None),
    plan: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_role("super_admin")),
    service: TenantService = Depends(_get_service),
) -> PaginatedTenants:
    return await service.list_tenants(estado, plan, search, page, page_size)


@router.post("/tenants", response_model=TenantCreateResponse, status_code=201)
async def create_tenant(
    body: TenantCreate,
    current_user: dict = Depends(require_role("super_admin")),
    service: TenantService = Depends(_get_service),
) -> TenantOut:
    return await service.create_tenant(body)


@router.get("/tenants/me", response_model=TenantOut)
async def get_tenant_me(
    current_user: dict = Depends(require_role("admin_empresa", "rrhh")),
    service: TenantService = Depends(_get_service),
) -> TenantOut:
    return await service.get_tenant(current_user["tenant_id"])


@router.patch("/tenants/me/branding", response_model=TenantOut)
async def update_branding(
    body: TenantBrandingUpdate,
    current_user: dict = Depends(require_role("admin_empresa")),
    service: TenantService = Depends(_get_service),
) -> TenantOut:
    return await service.update_branding(current_user["tenant_id"], body)


@router.get("/tenants/{tenant_id}", response_model=TenantOut)
async def get_tenant(
    tenant_id: UUID,
    current_user: dict = Depends(require_role("super_admin")),
    service: TenantService = Depends(_get_service),
) -> TenantOut:
    return await service.get_tenant(str(tenant_id))


@router.patch("/tenants/{tenant_id}", response_model=TenantOut)
async def update_tenant(
    tenant_id: UUID,
    body: TenantUpdate,
    current_user: dict = Depends(require_role("super_admin")),
    service: TenantService = Depends(_get_service),
) -> TenantOut:
    return await service.update_tenant(str(tenant_id), body)




# ── Usuarios por tenant (super_admin) ────────────────────────────────────────

@router.get("/tenants/{tenant_id}/users", response_model=list[UserSummary])
async def list_tenant_users(
    tenant_id: UUID,
    current_user: dict = Depends(require_role("super_admin")),
    db: AsyncClient = Depends(get_supabase),
):
    """Lista todos los usuarios de un tenant específico."""
    users = await UserRepository(db).list_users_by_tenant(str(tenant_id))
    return [UserSummary.model_validate(u) for u in users]


@router.patch("/tenants/{tenant_id}/users/{user_id}/set-role", response_model=UserSummary)
async def set_tenant_user_role(
    tenant_id: UUID,
    user_id: UUID,
    body: SetAdminRequest,
    current_user: dict = Depends(require_role("super_admin")),
    db: AsyncClient = Depends(get_supabase),
):
    """Cambia el rol de un usuario dentro de un tenant."""
    from fastapi import HTTPException, status
    updated = await UserRepository(db).set_role(str(user_id), body.role, str(tenant_id))
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado en este tenant")
    return UserSummary.model_validate(updated)


@router.patch("/tenants/{tenant_id}/users/{user_id}/set-roles", response_model=UserSummary)
async def set_tenant_user_roles(
    tenant_id: UUID,
    user_id: UUID,
    body: SetRolesRequest,
    current_user: dict = Depends(require_role("super_admin")),
    db: AsyncClient = Depends(get_supabase),
):
    """Asigna múltiples roles a un usuario dentro de un tenant."""
    from fastapi import HTTPException, status
    updated = await UserRepository(db).set_roles(str(user_id), body.roles, str(tenant_id))
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado en este tenant")
    return UserSummary.model_validate(updated)


# ── Sedes ─────────────────────────────────────────────────────────────────────

@router.get("/sedes", response_model=PaginatedSedes)
async def list_sedes(
    is_active: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(require_role("admin_empresa", "rrhh")),
    service: TenantService = Depends(_get_service),
) -> PaginatedSedes:
    return await service.list_sedes(current_user["tenant_id"], is_active, page, page_size)


@router.post("/sedes", response_model=SedeOut, status_code=201)
async def create_sede(
    body: SedeCreate,
    current_user: dict = Depends(require_role("admin_empresa")),
    service: TenantService = Depends(_get_service),
) -> SedeOut:
    return await service.create_sede(current_user["tenant_id"], body)


@router.patch("/sedes/{sede_id}", response_model=SedeOut)
async def update_sede(
    sede_id: UUID,
    body: SedeUpdate,
    current_user: dict = Depends(require_role("admin_empresa")),
    service: TenantService = Depends(_get_service),
) -> SedeOut:
    return await service.update_sede(str(sede_id), current_user["tenant_id"], body)


# ── Departamentos ─────────────────────────────────────────────────────────────

@router.get("/departamentos", response_model=list[DepartamentoOut])
async def list_departamentos(
    is_active: bool | None = Query(default=None),
    current_user: dict = Depends(require_role("admin_empresa", "rrhh")),
    service: TenantService = Depends(_get_service),
) -> list[DepartamentoOut]:
    return await service.list_departamentos(current_user["tenant_id"], is_active)


@router.post("/departamentos", response_model=DepartamentoOut, status_code=201)
async def create_departamento(
    body: DepartamentoCreate,
    current_user: dict = Depends(require_role("admin_empresa")),
    service: TenantService = Depends(_get_service),
) -> DepartamentoOut:
    return await service.create_departamento(current_user["tenant_id"], body)


@router.patch("/departamentos/{depto_id}", response_model=DepartamentoOut)
async def update_departamento(
    depto_id: UUID,
    body: DepartamentoUpdate,
    current_user: dict = Depends(require_role("admin_empresa")),
    service: TenantService = Depends(_get_service),
) -> DepartamentoOut:
    return await service.update_departamento(str(depto_id), current_user["tenant_id"], body)


# ── Puestos ───────────────────────────────────────────────────────────────────

@router.get("/puestos", response_model=PaginatedPuestos)
async def list_puestos(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(require_role("admin_empresa", "rrhh", "servicio_medico")),
    service: TenantService = Depends(_get_service),
) -> PaginatedPuestos:
    return await service.list_puestos(current_user["tenant_id"], page, page_size)


@router.post("/puestos", response_model=PuestoOut, status_code=201)
async def create_puesto(
    body: PuestoCreate,
    current_user: dict = Depends(require_role("admin_empresa")),
    service: TenantService = Depends(_get_service),
) -> PuestoOut:
    return await service.create_puesto(current_user["tenant_id"], body)


@router.patch("/puestos/{puesto_id}", response_model=PuestoOut)
async def update_puesto(
    puesto_id: UUID,
    body: PuestoUpdate,
    current_user: dict = Depends(require_role("admin_empresa")),
    service: TenantService = Depends(_get_service),
) -> PuestoOut:
    return await service.update_puesto(str(puesto_id), current_user["tenant_id"], body)


# ── Convenios ─────────────────────────────────────────────────────────────────

@router.get("/convenios", response_model=list[ConvenioOut])
async def list_convenios(
    current_user: dict = Depends(require_role("admin_empresa", "rrhh")),
    service: TenantService = Depends(_get_service),
) -> list[ConvenioOut]:
    return await service.list_convenios(current_user["tenant_id"])


@router.post("/convenios", response_model=ConvenioOut, status_code=201)
async def create_convenio(
    body: ConvenioCreate,
    current_user: dict = Depends(require_role("admin_empresa")),
    service: TenantService = Depends(_get_service),
) -> ConvenioOut:
    return await service.create_convenio(current_user["tenant_id"], body)
