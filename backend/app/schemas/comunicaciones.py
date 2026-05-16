from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ── Adjuntos ──────────────────────────────────────────────────────────────────

class AdjuntoOut(BaseModel):
    id: UUID
    comunicacion_id: UUID
    filename: str
    file_url: str
    file_size_bytes: int
    mime_type: str
    created_at: datetime


# ── Comunicacion ──────────────────────────────────────────────────────────────

class ComunicacionCreate(BaseModel):
    asunto: str = Field(..., max_length=200)
    cuerpo: str = Field(..., max_length=5000)
    tipo_segmento: str = Field(..., pattern="^(todos|sede|departamento|puesto|lista_custom)$")
    segmento_config: dict[str, Any] = Field(default_factory=dict)
    requiere_confirmacion: bool = False
    programado_at: datetime | None = None

    @model_validator(mode="after")
    def validate_segmento_config(self) -> "ComunicacionCreate":
        if self.tipo_segmento != "todos" and not self.segmento_config:
            raise ValueError("segmento_config es requerido cuando tipo_segmento no es 'todos'")
        return self


class ComunicacionSummary(BaseModel):
    id: UUID
    asunto: str
    cuerpo: str
    tipo_segmento: str
    requiere_confirmacion: bool
    estado: str
    total_destinatarios: int
    enviado_at: datetime | None
    created_at: datetime


class DestinatarioOut(BaseModel):
    id: UUID
    user_id: UUID
    nombre: str
    email: str
    estado: str
    leido_at: datetime | None
    confirmado_at: datetime | None


class MetricasOut(BaseModel):
    enviados: int
    entregados: int
    leidos: int
    confirmados: int


class ComunicacionOut(BaseModel):
    id: UUID
    tenant_id: UUID
    asunto: str
    cuerpo: str
    tipo_segmento: str
    segmento_config: dict[str, Any]
    requiere_confirmacion: bool
    programado_at: datetime | None
    enviado_at: datetime | None
    estado: str
    total_destinatarios: int
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    comunicacion_adjuntos: list[AdjuntoOut] = Field(default_factory=list)
    metricas: MetricasOut | None = None


class EnviarResponse(BaseModel):
    estado: str
    total_destinatarios: int


class ReenviarResponse(BaseModel):
    reenviados: int


# ── Vista colaborador ─────────────────────────────────────────────────────────
# NOTE: Supabase nested join returns data under the TABLE name key ("comunicaciones"),
# so the field must be named "comunicaciones" to match Supabase's response format.

class ComunicacionColaboradorItem(BaseModel):
    id: UUID
    estado: str
    enviado_at: datetime | None
    leido_at: datetime | None
    confirmado_at: datetime | None
    comunicaciones: dict[str, Any] = Field(default_factory=dict)


class LeerResponse(BaseModel):
    leido_at: str


class ConfirmarResponse(BaseModel):
    confirmado_at: str


# ── Paginación ────────────────────────────────────────────────────────────────

class PaginatedComunicaciones(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int
    items: list[ComunicacionSummary]


class PaginatedComunicacionesColaborador(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int
    items: list[ComunicacionColaboradorItem]
