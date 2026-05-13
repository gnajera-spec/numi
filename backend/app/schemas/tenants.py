import math
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

TenantPlan   = Literal["starter", "professional", "enterprise"]
TenantEstado = Literal["activo", "suspendido", "baja"]


# ── Tenant ────────────────────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    nombre: str = Field(..., min_length=2)
    nombre_corto: str = Field(..., max_length=50)
    cuit: str = Field(..., pattern=r"^\d{11}$")
    subdominio: str = Field(..., pattern=r"^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$")
    plan: TenantPlan
    admin_email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")
    admin_first_name: str = Field(..., min_length=2)
    admin_last_name: str = Field(..., min_length=2)
    logo_url: str | None = None
    color_primario: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")


class TenantUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=2)
    nombre_corto: str | None = Field(None, max_length=50)
    plan: TenantPlan | None = None
    estado: TenantEstado | None = None
    logo_url: str | None = None
    color_primario: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")


class TenantBrandingUpdate(BaseModel):
    logo_url: str | None = None
    color_primario: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    nombre_corto: str | None = Field(None, max_length=50)


class TenantSummary(BaseModel):
    id: UUID
    nombre: str
    nombre_corto: str
    subdominio: str
    plan: str
    estado: str
    logo_url: str | None
    color_primario: str | None


class TenantOut(TenantSummary):
    cuit: str
    whatsapp_numero: str | None
    max_colaboradores: int
    created_at: datetime
    updated_at: datetime


class PaginatedTenants(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int
    items: list[TenantSummary]


# ── Sede ──────────────────────────────────────────────────────────────────────

class SedeCreate(BaseModel):
    nombre: str = Field(..., min_length=2)
    direccion: str | None = None
    ciudad: str | None = None
    provincia: str | None = None


class SedeUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=2)
    direccion: str | None = None
    ciudad: str | None = None
    provincia: str | None = None
    is_active: bool | None = None


class SedeOut(BaseModel):
    id: UUID
    tenant_id: UUID
    nombre: str
    direccion: str | None
    ciudad: str | None
    provincia: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PaginatedSedes(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int
    items: list[SedeOut]


# ── Departamento ──────────────────────────────────────────────────────────────

class DepartamentoCreate(BaseModel):
    nombre: str = Field(..., min_length=2)
    padre_id: UUID | None = None


class DepartamentoUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=2)
    padre_id: UUID | None = None
    is_active: bool | None = None


class DepartamentoOut(BaseModel):
    id: UUID
    tenant_id: UUID
    nombre: str
    padre_id: UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    hijos: list["DepartamentoOut"] = []


DepartamentoOut.model_rebuild()


# ── Puesto ────────────────────────────────────────────────────────────────────

class PuestoCreate(BaseModel):
    nombre: str = Field(..., min_length=2)
    descripcion: str | None = None
    meses_vigencia_aptitud: int | None = Field(None, ge=1, le=60)


class PuestoUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=2)
    descripcion: str | None = None
    meses_vigencia_aptitud: int | None = Field(None, ge=1, le=60)
    is_active: bool | None = None


class PuestoOut(BaseModel):
    id: UUID
    tenant_id: UUID
    nombre: str
    descripcion: str | None
    meses_vigencia_aptitud: int | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PaginatedPuestos(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int
    items: list[PuestoOut]


# ── Convenio ──────────────────────────────────────────────────────────────────

class ConvenioCreate(BaseModel):
    nombre: str = Field(..., min_length=2)
    descripcion: str | None = None


class ConvenioOut(BaseModel):
    id: UUID
    tenant_id: UUID
    nombre: str
    descripcion: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
