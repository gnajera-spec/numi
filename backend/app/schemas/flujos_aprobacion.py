from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ─── Paso ────────────────────────────────────────────────────────────────────

class PasoFlujoCreate(BaseModel):
    orden: int = Field(..., ge=1, le=5)
    nombre: str = Field(..., max_length=100)
    tipo_aprobador: str  # 'rol' | 'departamento'
    rol_aprobador: str | None = None
    departamento_id: UUID | None = None
    sla_horas: int | None = Field(None, gt=0)
    requiere_comentario: bool = False

    @model_validator(mode="after")
    def check_aprobador_exclusivity(self) -> "PasoFlujoCreate":
        if self.tipo_aprobador == "rol":
            if not self.rol_aprobador or self.departamento_id:
                raise ValueError("Paso tipo 'rol' requiere rol_aprobador y no debe tener departamento_id")
            if self.rol_aprobador not in ("rrhh", "servicio_medico", "admin_empresa"):
                raise ValueError("rol_aprobador debe ser rrhh, servicio_medico o admin_empresa")
        elif self.tipo_aprobador == "departamento":
            if not self.departamento_id or self.rol_aprobador:
                raise ValueError("Paso tipo 'departamento' requiere departamento_id y no debe tener rol_aprobador")
        else:
            raise ValueError("tipo_aprobador debe ser 'rol' o 'departamento'")
        return self


class PasoFlujoOut(BaseModel):
    id: UUID
    flujo_id: UUID
    tenant_id: UUID
    orden: int
    nombre: str
    tipo_aprobador: str
    rol_aprobador: str | None
    departamento_id: UUID | None
    departamento_nombre: str | None = None
    sla_horas: int | None
    requiere_comentario: bool
    created_at: datetime


# ─── Flujo ────────────────────────────────────────────────────────────────────

class FlujoAprobacionCreate(BaseModel):
    tipo_licencia_id: UUID
    nombre: str = Field(..., max_length=100)
    descripcion: str | None = None
    pasos: list[PasoFlujoCreate] = Field(..., min_length=1, max_length=5)

    @model_validator(mode="after")
    def check_pasos_contiguos(self) -> "FlujoAprobacionCreate":
        ordenes = sorted(p.orden for p in self.pasos)
        expected = list(range(1, len(ordenes) + 1))
        if ordenes != expected:
            raise ValueError(f"Los pasos deben tener orden contiguo sin gaps: {expected}")
        return self


class FlujoAprobacionUpdate(BaseModel):
    nombre: str | None = Field(None, max_length=100)
    descripcion: str | None = None
    pasos: list[PasoFlujoCreate] | None = Field(None, min_length=1, max_length=5)

    @model_validator(mode="after")
    def check_pasos_contiguos(self) -> "FlujoAprobacionUpdate":
        if self.pasos is not None:
            ordenes = sorted(p.orden for p in self.pasos)
            expected = list(range(1, len(ordenes) + 1))
            if ordenes != expected:
                raise ValueError(f"Los pasos deben tener orden contiguo sin gaps: {expected}")
        return self


class FlujoAprobacionOut(BaseModel):
    id: UUID
    tenant_id: UUID
    tipo_licencia_id: UUID
    tipo_licencia_nombre: str | None = None
    tipo_licencia_codigo: str | None = None
    nombre: str
    descripcion: str | None
    is_active: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    pasos: list[PasoFlujoOut] = []


# ─── Lista con overview ───────────────────────────────────────────────────────

class TipoLicenciaConFlujoOut(BaseModel):
    tipo_licencia_id: UUID
    tipo_licencia_nombre: str
    tipo_licencia_codigo: str
    flujo_id: UUID | None
    flujo_nombre: str | None
    pasos_count: int
    is_active: bool | None  # None cuando no hay flujo


# ─── Aprobación por paso ─────────────────────────────────────────────────────

class AprobarPasoRequest(BaseModel):
    comentario: str | None = None


class RechazarPasoRequest(BaseModel):
    comentario: str = Field(..., min_length=1)


class AprobacionSolicitudOut(BaseModel):
    id: UUID
    solicitud_id: UUID
    tenant_id: UUID
    paso_id: UUID
    orden: int
    nombre_paso: str
    tipo_aprobador: str
    rol_aprobador: str | None
    departamento_id: UUID | None
    departamento_nombre: str | None
    estado: str
    aprobado_por: UUID | None
    aprobado_por_nombre: str | None = None
    comentario: str | None
    notificado_at: datetime | None
    fecha_decision: datetime | None
    created_at: datetime
    updated_at: datetime
