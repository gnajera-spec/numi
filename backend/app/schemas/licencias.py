from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.users import Pagination


# ── Tipos ─────────────────────────────────────────────────────────────────────

class TipoLicenciaOut(BaseModel):
    id: UUID
    tenant_id: UUID | None
    codigo: str
    nombre: str
    descripcion: str | None
    requiere_certificado: bool
    es_medica: bool
    dias_maximos: int | None
    is_active: bool

    model_config = {"from_attributes": True}


class CreateTipoLicenciaRequest(BaseModel):
    codigo: str = Field(min_length=1, max_length=10, pattern=r"^[A-Z0-9\-]+$")
    nombre: str = Field(min_length=1)
    descripcion: str | None = None
    requiere_certificado: bool = False
    dias_maximos: int | None = Field(default=None, ge=1, le=365)


# ── Políticas ─────────────────────────────────────────────────────────────────

class PoliticaLicenciaOut(BaseModel):
    id: UUID
    tenant_id: UUID
    tipo_licencia_id: UUID
    convenio_id: UUID | None
    dias_base: int
    reglas_antiguedad: list[dict[str, Any]] | None
    requiere_aprobacion: bool
    dias_aviso_previo: int
    aprobador_rol: str
    is_active: bool

    model_config = {"from_attributes": True}


class CreatePoliticaRequest(BaseModel):
    tipo_licencia_id: UUID
    convenio_id: UUID | None = None
    dias_base: int = Field(ge=1)
    reglas_antiguedad: list[dict[str, Any]] | None = None
    requiere_aprobacion: bool = True
    dias_aviso_previo: int = Field(default=0, ge=0)
    aprobador_rol: str = "rrhh"

    @model_validator(mode="after")
    def validate_aprobador(self) -> "CreatePoliticaRequest":
        if self.aprobador_rol not in ("rrhh", "admin_empresa"):
            raise ValueError("aprobador_rol debe ser 'rrhh' o 'admin_empresa'")
        return self


# ── Solicitudes ───────────────────────────────────────────────────────────────

class TipoLicenciaRef(BaseModel):
    id: UUID
    codigo: str
    nombre: str


class RevisadoPorRef(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    full_name: str = ""

    @model_validator(mode="after")
    def compute_full_name(self) -> "RevisadoPorRef":
        self.full_name = f"{self.first_name} {self.last_name}".strip()
        return self


class SolicitudLicenciaOut(BaseModel):
    id: UUID
    numero_solicitud: str
    tipo_licencia: TipoLicenciaRef
    fecha_inicio: date
    fecha_fin: date
    dias_habiles: int
    estado: str
    comentario_empleado: str | None
    comentario_rrhh: str | None
    revisado_por: RevisadoPorRef | None
    revisado_at: datetime | None
    canal: str
    documentos: list[dict] = []
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_row(cls, row: dict) -> "SolicitudLicenciaOut":
        tipo_data = row.get("tipos_licencia") or {}
        revisado_data = row.get("revisado_por_user")

        return cls(
            id=row["id"],
            numero_solicitud=row["numero_solicitud"],
            tipo_licencia=TipoLicenciaRef(
                id=tipo_data.get("id", row["tipo_licencia_id"]),
                codigo=tipo_data.get("codigo", ""),
                nombre=tipo_data.get("nombre", ""),
            ),
            fecha_inicio=row["fecha_inicio"],
            fecha_fin=row["fecha_fin"],
            dias_habiles=row["dias_habiles"],
            estado=row["estado"],
            comentario_empleado=row.get("comentario_empleado"),
            comentario_rrhh=row.get("comentario_rrhh"),
            revisado_por=RevisadoPorRef.model_validate(revisado_data) if revisado_data else None,
            revisado_at=row.get("revisado_at"),
            canal=row["canal"],
            documentos=row.get("documentos_solicitud") or [],
            created_at=row["created_at"],
        )


class CreateSolicitudRequest(BaseModel):
    tipo_licencia_id: UUID
    fecha_inicio: date
    fecha_fin: date
    comentario: str | None = Field(default=None, max_length=500)
    user_id: UUID | None = None  # only rrhh+ can set this

    @model_validator(mode="after")
    def validate_fechas(self) -> "CreateSolicitudRequest":
        if self.fecha_fin < self.fecha_inicio:
            raise ValueError("fecha_fin debe ser mayor o igual a fecha_inicio")
        return self


class AprobarSolicitudRequest(BaseModel):
    comentario: str | None = None


class RechazarSolicitudRequest(BaseModel):
    comentario: str = Field(min_length=1, max_length=500)


# ── Saldo ─────────────────────────────────────────────────────────────────────

class SaldoLicenciaOut(BaseModel):
    tipo_licencia: TipoLicenciaRef
    anio: int
    dias_disponibles: int
    dias_tomados: int
    dias_pendientes: int
    dias_restantes: int = 0

    @model_validator(mode="after")
    def compute_restantes(self) -> "SaldoLicenciaOut":
        self.dias_restantes = max(0, self.dias_disponibles - self.dias_tomados - self.dias_pendientes)
        return self

    @classmethod
    def from_row(cls, row: dict) -> "SaldoLicenciaOut":
        tipo_data = row.get("tipos_licencia") or {}
        return cls(
            tipo_licencia=TipoLicenciaRef(
                id=tipo_data.get("id", row["tipo_licencia_id"]),
                codigo=tipo_data.get("codigo", ""),
                nombre=tipo_data.get("nombre", ""),
            ),
            anio=row["anio"],
            dias_disponibles=row["dias_disponibles"],
            dias_tomados=row["dias_tomados"],
            dias_pendientes=row["dias_pendientes"],
        )


# ── Paginación ────────────────────────────────────────────────────────────────

class PaginatedSolicitudes(BaseModel):
    data: list[SolicitudLicenciaOut]
    pagination: Pagination
