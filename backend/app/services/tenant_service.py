"""
Tenant service: CRUD tenants (super_admin), branding propio (admin_empresa),
estructura organizacional: sedes, departamentos, puestos, convenios.
"""
import math
import logging

from fastapi import HTTPException, status

from app.repositories.convenio_repository import ConvenioRepository
from app.repositories.departamento_repository import DepartamentoRepository
from app.repositories.puesto_repository import PuestoRepository
from app.repositories.sede_repository import SedeRepository
from app.repositories.tenant_repository import TenantRepository
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
    TenantBrandingUpdate,
    TenantCreate,
    TenantOut,
    TenantSummary,
    TenantUpdate,
)

logger = logging.getLogger(__name__)


class TenantService:
    def __init__(
        self,
        tenants: TenantRepository,
        sedes: SedeRepository,
        deptos: DepartamentoRepository,
        puestos: PuestoRepository,
        convenios: ConvenioRepository,
    ) -> None:
        self._tenants = tenants
        self._sedes = sedes
        self._deptos = deptos
        self._puestos = puestos
        self._convenios = convenios

    # ── Tenants (super_admin) ─────────────────────────────────────────────────

    async def list_tenants(
        self,
        estado: str | None,
        plan: str | None,
        search: str | None,
        page: int,
        page_size: int,
    ) -> PaginatedTenants:
        rows, total = await self._tenants.list(estado, plan, search, page, page_size)
        return PaginatedTenants(
            total=total,
            page=page,
            page_size=page_size,
            pages=max(1, math.ceil(total / page_size)),
            items=[TenantSummary(**r) for r in rows],
        )

    async def create_tenant(self, body: TenantCreate) -> TenantOut:
        if await self._tenants.get_by_cuit(body.cuit):
            raise HTTPException(status.HTTP_409_CONFLICT, detail="CUIT ya registrado")
        if await self._tenants.get_by_subdominio(body.subdominio):
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Subdominio ya registrado")

        data = body.model_dump(exclude={"admin_email", "admin_first_name", "admin_last_name"})
        row = await self._tenants.create(data)
        # La creación del admin_empresa se realiza en una tarea de fondo fuera de scope v1
        # (requiere invite_token + email; pendiente DT)
        return TenantOut(**row)

    async def get_tenant(self, tenant_id: str) -> TenantOut:
        row = await self._tenants.get(tenant_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")
        return TenantOut(**row)

    async def update_tenant(self, tenant_id: str, body: TenantUpdate) -> TenantOut:
        if not await self._tenants.get(tenant_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")
        data = body.model_dump(exclude_none=True)
        if not data:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Sin campos para actualizar")
        row = await self._tenants.update(tenant_id, data)
        return TenantOut(**row)

    async def update_branding(self, tenant_id: str, body: TenantBrandingUpdate) -> TenantOut:
        if not await self._tenants.get(tenant_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")
        data = body.model_dump(exclude_none=True)
        if not data:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Sin campos para actualizar")
        row = await self._tenants.update(tenant_id, data)
        return TenantOut(**row)

    # ── Sedes ─────────────────────────────────────────────────────────────────

    async def list_sedes(
        self, tenant_id: str, is_active: bool | None, page: int, page_size: int
    ) -> PaginatedSedes:
        rows, total = await self._sedes.list(tenant_id, is_active, page, page_size)
        return PaginatedSedes(
            total=total,
            page=page,
            page_size=page_size,
            pages=max(1, math.ceil(total / page_size)),
            items=[SedeOut(**r) for r in rows],
        )

    async def create_sede(self, tenant_id: str, body: SedeCreate) -> SedeOut:
        if await self._sedes.get_by_nombre(tenant_id, body.nombre):
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Ya existe una sede con ese nombre")
        row = await self._sedes.create({"tenant_id": tenant_id, **body.model_dump()})
        return SedeOut(**row)

    async def update_sede(self, sede_id: str, tenant_id: str, body: SedeUpdate) -> SedeOut:
        if not await self._sedes.get(sede_id, tenant_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Sede no encontrada")
        data = body.model_dump(exclude_none=True)
        if not data:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Sin campos para actualizar")
        row = await self._sedes.update(sede_id, tenant_id, data)
        return SedeOut(**row)

    # ── Departamentos ─────────────────────────────────────────────────────────

    async def list_departamentos(
        self, tenant_id: str, is_active: bool | None
    ) -> list[DepartamentoOut]:
        rows = await self._deptos.list(tenant_id, is_active)
        return _build_tree(rows)

    async def create_departamento(
        self, tenant_id: str, body: DepartamentoCreate
    ) -> DepartamentoOut:
        padre_id = str(body.padre_id) if body.padre_id else None
        if await self._deptos.get_by_nombre(tenant_id, body.nombre, padre_id):
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Ya existe un departamento con ese nombre en ese nivel")
        if padre_id:
            padre = await self._deptos.get(padre_id, tenant_id)
            if not padre:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Departamento padre no encontrado")
            nivel_padre = await self._deptos.count_niveles(padre_id, tenant_id)
            if nivel_padre >= 3:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Máximo 3 niveles de jerarquía permitidos",
                )
        data = body.model_dump()
        data["tenant_id"] = tenant_id
        if data.get("padre_id"):
            data["padre_id"] = str(data["padre_id"])
        row = await self._deptos.create(data)
        return DepartamentoOut(**row)

    async def update_departamento(
        self, depto_id: str, tenant_id: str, body: DepartamentoUpdate
    ) -> DepartamentoOut:
        if not await self._deptos.get(depto_id, tenant_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Departamento no encontrado")
        data = body.model_dump(exclude_none=True)
        if not data:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Sin campos para actualizar")
        if "padre_id" in data and data["padre_id"]:
            data["padre_id"] = str(data["padre_id"])
        row = await self._deptos.update(depto_id, tenant_id, data)
        return DepartamentoOut(**row)

    # ── Puestos ───────────────────────────────────────────────────────────────

    async def list_puestos(
        self, tenant_id: str, page: int, page_size: int
    ) -> PaginatedPuestos:
        rows, total = await self._puestos.list(tenant_id, page, page_size)
        return PaginatedPuestos(
            total=total,
            page=page,
            page_size=page_size,
            pages=max(1, math.ceil(total / page_size)),
            items=[PuestoOut(**r) for r in rows],
        )

    async def create_puesto(self, tenant_id: str, body: PuestoCreate) -> PuestoOut:
        if await self._puestos.get_by_nombre(tenant_id, body.nombre):
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Ya existe un puesto con ese nombre")
        row = await self._puestos.create({"tenant_id": tenant_id, **body.model_dump()})
        return PuestoOut(**row)

    async def update_puesto(
        self, puesto_id: str, tenant_id: str, body: PuestoUpdate
    ) -> PuestoOut:
        if not await self._puestos.get(puesto_id, tenant_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Puesto no encontrado")
        data = body.model_dump(exclude_none=True)
        if not data:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Sin campos para actualizar")
        row = await self._puestos.update(puesto_id, tenant_id, data)
        return PuestoOut(**row)

    # ── Convenios ─────────────────────────────────────────────────────────────

    async def list_convenios(self, tenant_id: str) -> list[ConvenioOut]:
        rows = await self._convenios.list(tenant_id)
        return [ConvenioOut(**r) for r in rows]

    async def create_convenio(self, tenant_id: str, body: ConvenioCreate) -> ConvenioOut:
        if await self._convenios.get_by_nombre(tenant_id, body.nombre):
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Ya existe un convenio con ese nombre")
        row = await self._convenios.create({"tenant_id": tenant_id, **body.model_dump()})
        return ConvenioOut(**row)


def _build_tree(rows: list[dict]) -> list[DepartamentoOut]:
    """Construye árbol de departamentos a partir de lista plana."""
    by_id = {str(r["id"]): DepartamentoOut(**r) for r in rows}
    roots = []
    for item in by_id.values():
        padre_id = str(item.padre_id) if item.padre_id else None
        if padre_id and padre_id in by_id:
            by_id[padre_id].hijos.append(item)
        else:
            roots.append(item)
    return roots
