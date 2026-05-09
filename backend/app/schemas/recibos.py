import re
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.schemas.users import Pagination


class CreatePeriodoRequest(BaseModel):
    periodo: str
    descripcion: str | None = None
    fecha_inicio: date
    fecha_fin: date
    fecha_limite_firma: date | None = None

    @field_validator("periodo")
    @classmethod
    def periodo_format(cls, v: str) -> str:
        if not re.match(r"^\d{4}-(0[1-9]|1[0-2])$", v):
            raise ValueError("El período debe tener formato YYYY-MM")
        return v

    @field_validator("fecha_fin")
    @classmethod
    def fecha_fin_after_inicio(cls, v: date, info) -> date:
        inicio = info.data.get("fecha_inicio")
        if inicio and v < inicio:
            raise ValueError("fecha_fin debe ser mayor o igual a fecha_inicio")
        return v


class PeriodoOut(BaseModel):
    id: UUID
    periodo: str
    descripcion: str | None = None
    fecha_inicio: date
    fecha_fin: date
    fecha_limite_firma: date | None = None
    estado: str
    total_recibos: int
    recibos_firmados: int
    pct_firmados: float

    model_config = {"from_attributes": True}

    @classmethod
    def from_row(cls, row: dict) -> "PeriodoOut":
        total = row.get("total_recibos") or 0
        firmados = row.get("recibos_firmados") or 0
        pct = round(firmados / total * 100, 1) if total > 0 else 0.0
        return cls(
            id=row["id"],
            periodo=row["periodo"],
            descripcion=row.get("descripcion"),
            fecha_inicio=row["fecha_inicio"],
            fecha_fin=row["fecha_fin"],
            fecha_limite_firma=row.get("fecha_limite_firma"),
            estado=row["estado"],
            total_recibos=total,
            recibos_firmados=firmados,
            pct_firmados=pct,
        )


class PaginatedPeriodos(BaseModel):
    data: list[PeriodoOut]
    pagination: Pagination


class PreviewItem(BaseModel):
    cuil: str
    nombre: str | None = None
    archivo: str
    user_id: UUID | None = None
    matched: bool


class UploadResponse(BaseModel):
    job_id: str
    total_archivos: int
    preview: list[PreviewItem]


class ConfirmResponse(BaseModel):
    distribuidos: int
    errores: list[str]


class FirmaOut(BaseModel):
    canal: str
    timestamp_firma: datetime
    archivo_hash: str

    model_config = {"from_attributes": True}


class ReciboOut(BaseModel):
    id: UUID
    periodo: str
    descripcion: str | None = None
    estado: str
    file_url: str | None = None
    archivo_hash: str
    fecha_limite_firma: date | None = None
    notificado_at: datetime | None = None
    firma: FirmaOut | None = None

    model_config = {"from_attributes": True}


class ReciboDashboard(BaseModel):
    id: UUID
    user_id: UUID
    nombre: str
    cuil: str | None = None
    legajo: str | None = None
    estado: str
    notificado_at: datetime | None = None
    visto_at: datetime | None = None
    firmado_at: datetime | None = None

    model_config = {"from_attributes": True}


class PaginatedRecibos(BaseModel):
    data: list[ReciboOut]
    pagination: Pagination


class PaginatedDashboard(BaseModel):
    data: list[ReciboDashboard]
    pagination: Pagination


class FirmarRequest(BaseModel):
    canal: str
    conformidad: bool

    @field_validator("canal")
    @classmethod
    def canal_valid(cls, v: str) -> str:
        if v not in ("portal", "whatsapp"):
            raise ValueError("canal debe ser 'portal' o 'whatsapp'")
        return v

    @field_validator("conformidad")
    @classmethod
    def must_be_true(cls, v: bool) -> bool:
        if not v:
            raise ValueError("conformidad debe ser true para firmar")
        return v


class RenotificarRequest(BaseModel):
    user_ids: list[UUID] = []
