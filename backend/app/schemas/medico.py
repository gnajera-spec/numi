from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ── Ficha médica ──────────────────────────────────────────────────────────────

class FichaMedicaUpdate(BaseModel):
    grupo_sanguineo: str | None = Field(None, pattern=r"^(A\+|A\-|B\+|B\-|AB\+|AB\-|O\+|O\-)$")
    factor_rh: str | None = Field(None, pattern=r"^(positivo|negativo)$")
    alergias: list[dict[str, Any]] | None = None
    condiciones: list[dict[str, Any]] | None = None
    observaciones: str | None = None


class FichaMedicaOut(BaseModel):
    id: UUID
    tenant_id: UUID
    user_id: UUID
    grupo_sanguineo: str | None
    factor_rh: str | None
    alergias: list[dict[str, Any]] | None = None
    condiciones: list[dict[str, Any]] | None = None
    observaciones: str | None
    created_at: datetime
    updated_at: datetime


class FichaMedicaSummary(BaseModel):
    user_id: UUID
    nombre_completo: str
    email: str
    grupo_sanguineo: str | None
    tiene_ficha: bool


class PaginatedFichas(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int
    items: list[FichaMedicaSummary]


# ── Exámenes médicos ──────────────────────────────────────────────────────────

class ExamenCreate(BaseModel):
    tipo: str = Field(..., pattern=r"^(ingreso|periodico|post_ausencia|egreso)$")
    fecha: date
    resultado: str | None = None
    medico_responsable: str | None = None


class ExamenOut(BaseModel):
    id: UUID
    tenant_id: UUID
    user_id: UUID
    tipo: str
    fecha: date
    resultado: str | None
    medico_responsable: str | None
    storage_path: str | None
    created_by: UUID
    created_at: datetime


# ── Vacunaciones ──────────────────────────────────────────────────────────────

class VacunacionCreate(BaseModel):
    vacuna: str = Field(..., min_length=1, max_length=200)
    fecha: date
    lote: str | None = None
    proxima_dosis: date | None = None


class VacunacionOut(BaseModel):
    id: UUID
    tenant_id: UUID
    user_id: UUID
    vacuna: str
    fecha: date
    lote: str | None
    proxima_dosis: date | None
    created_by: UUID
    created_at: datetime


# ── Aptitudes laborales ───────────────────────────────────────────────────────

class AptitudCreate(BaseModel):
    puesto_id: UUID
    estado: str = Field(..., pattern=r"^(apto|apto_con_restricciones|no_apto)$")
    restricciones: str | None = None
    fecha_emision: date
    fecha_vencimiento: date | None = None

    @model_validator(mode="after")
    def validate_restricciones(self) -> "AptitudCreate":
        if self.estado == "apto_con_restricciones" and not self.restricciones:
            raise ValueError("restricciones es requerido cuando estado es 'apto_con_restricciones'")
        return self


class AptitudOut(BaseModel):
    id: UUID
    tenant_id: UUID
    user_id: UUID
    puesto_id: UUID
    estado: str
    restricciones: str | None
    fecha_emision: date
    fecha_vencimiento: date | None
    emitido_por: UUID
    created_at: datetime


class AptitudPorVencerItem(BaseModel):
    user_id: UUID
    nombre_completo: str
    puesto: str
    estado: str
    fecha_vencimiento: date
    dias_restantes: int


# ── Accidentes de trabajo ─────────────────────────────────────────────────────

class Testigo(BaseModel):
    nombre: str
    legajo: str | None = None


class AccidenteCreate(BaseModel):
    user_id: UUID
    fecha_hora: datetime
    lugar: str = Field(..., min_length=1)
    descripcion: str = Field(..., min_length=1)
    testigos: list[Testigo] | None = None


class AccidenteUpdate(BaseModel):
    estado: str | None = Field(None, pattern=r"^(abierto|tratamiento|alta|cerrado)$")
    numero_art: str | None = None


class AccidenteOut(BaseModel):
    id: UUID
    tenant_id: UUID
    user_id: UUID
    fecha_hora: datetime
    lugar: str
    descripcion: str
    testigos: list[dict[str, Any]] | None
    numero_art: str | None
    estado: str
    created_by: UUID
    created_at: datetime
    updated_at: datetime


class PaginatedAccidentes(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int
    items: list[AccidenteOut]


# ── Reportes ──────────────────────────────────────────────────────────────────

class AbsentismoDeptItem(BaseModel):
    departamento: str
    dias_ausentes: int
    colaboradores: int
    tasa_pct: float


class ReporteAbsentismo(BaseModel):
    periodo: dict[str, str]
    por_departamento: list[AbsentismoDeptItem]
    total_dias_ausentes: int
    tasa_global_pct: float
