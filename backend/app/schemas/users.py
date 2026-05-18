from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.user import UserSummary

_ALLOWED_ROLES = {"colaborador", "rrhh", "servicio_medico"}
_ALLOWED_CONTRATOS = {"indefinido", "determinado", "eventual", "pasantia"}


class ColaboradorPerfilOut(BaseModel):
    sede_id: UUID | None = None
    departamento_id: UUID | None = None
    puesto_id: UUID | None = None
    convenio_id: UUID | None = None
    legajo: str | None = None
    fecha_ingreso: date | None = None
    tipo_contrato: str | None = None
    email_personal: str | None = None
    telefono_personal: str | None = None

    model_config = {"from_attributes": True}


class UserDetail(UserSummary):
    tenant_id: UUID | None = None
    cuil: str | None = None
    whatsapp_numero_masked: str | None = None
    last_login_at: datetime | None = None
    activated_at: datetime | None = None
    created_at: datetime
    colaborador_perfil: ColaboradorPerfilOut | None = None


class Pagination(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int
    next: str | None = None
    prev: str | None = None


class PaginatedUsers(BaseModel):
    data: list[UserSummary]
    pagination: Pagination


class CreateUserRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    cuil: str
    role: str
    whatsapp_numero: str
    sede_id: UUID | None = None
    departamento_id: UUID | None = None
    puesto_id: UUID | None = None
    convenio_id: UUID | None = None
    legajo: str | None = None
    fecha_ingreso: date | None = None
    tipo_contrato: str | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def min_length(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Debe tener al menos 2 caracteres")
        return v.strip()

    @field_validator("cuil")
    @classmethod
    def cuil_format(cls, v: str) -> str:
        digits = v.replace("-", "").replace(" ", "")
        if not digits.isdigit() or len(digits) != 11:
            raise ValueError("El CUIL debe tener 11 dígitos")
        return digits

    @field_validator("role")
    @classmethod
    def role_allowed(cls, v: str) -> str:
        if v not in _ALLOWED_ROLES:
            raise ValueError(f"Rol debe ser uno de: {', '.join(sorted(_ALLOWED_ROLES))}")
        return v

    @field_validator("tipo_contrato")
    @classmethod
    def contrato_allowed(cls, v: str | None) -> str | None:
        if v is not None and v not in _ALLOWED_CONTRATOS:
            raise ValueError(f"tipo_contrato debe ser uno de: {', '.join(sorted(_ALLOWED_CONTRATOS))}")
        return v


class UpdateUserRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    sede_id: UUID | None = None
    departamento_id: UUID | None = None
    puesto_id: UUID | None = None
    convenio_id: UUID | None = None
    legajo: str | None = None
    tipo_contrato: str | None = None
    fecha_ingreso: date | None = None


class UpdateOwnProfileRequest(BaseModel):
    email_personal: str | None = None
    telefono_personal: str | None = None


class SuspendRequest(BaseModel):
    motivo: str | None = None


class BajaRequest(BaseModel):
    motivo: str | None = None
    fecha_baja: date | None = None


class InviteResponse(BaseModel):
    expires_at: datetime
    sent_via: str = "whatsapp"


# ── Horario laboral ───────────────────────────────────────────────────────────

class HorarioItem(BaseModel):
    dia_semana: int = Field(..., ge=1, le=7)
    hora_inicio: str
    hora_fin: str


class HorarioRequest(BaseModel):
    horarios: list[HorarioItem]


class HorarioOut(BaseModel):
    dia_semana: int
    hora_inicio: str
    hora_fin: str


# ── Colaborador documentos ────────────────────────────────────────────────────

class ColaboradorDocumentoOut(BaseModel):
    id: UUID
    tipo: str
    filename: str
    file_url: str
    file_size_bytes: int
    mime_type: str
    descripcion: str | None = None
    uploaded_by: UUID
    created_at: datetime


_ALLOWED_TENANT_ROLES = {"colaborador", "rrhh", "admin_empresa", "servicio_medico"}


class SetRolesRequest(BaseModel):
    roles: list[str]

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Debe especificar al menos un rol")
        invalid = set(v) - _ALLOWED_TENANT_ROLES
        if invalid:
            raise ValueError(f"Roles no permitidos: {', '.join(sorted(invalid))}")
        result = list(set(v))
        if "colaborador" not in result:
            result.append("colaborador")
        return result
