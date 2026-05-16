from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


class InvitarIndividualRequest(BaseModel):
    cuil: str
    email: EmailStr

    @field_validator("cuil")
    @classmethod
    def cuil_format(cls, v: str) -> str:
        digits = v.replace("-", "").replace(" ", "")
        if not digits.isdigit() or len(digits) != 11:
            raise ValueError("El CUIL debe tener 11 dígitos")
        return digits


class InvitarLoteItem(BaseModel):
    cuil: str
    email: EmailStr

    @field_validator("cuil")
    @classmethod
    def cuil_format(cls, v: str) -> str:
        digits = v.replace("-", "").replace(" ", "")
        if not digits.isdigit() or len(digits) != 11:
            raise ValueError("El CUIL debe tener 11 dígitos")
        return digits


class InvitarLoteRequest(BaseModel):
    colaboradores: list[InvitarLoteItem]


class InvitacionCreada(BaseModel):
    token: UUID
    email: str
    cuil: str
    link: str
    expires_at: datetime


class LoteResultado(BaseModel):
    exitosos: list[InvitacionCreada]
    errores: list[dict]


class CompletarOnboardingRequest(BaseModel):
    nombre: str
    apellido: str
    email: EmailStr
    nro_documento: str
    password: str

    @field_validator("nombre", "apellido")
    @classmethod
    def min_length(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Debe tener al menos 2 caracteres")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v


class OnboardingTokenInfo(BaseModel):
    cuil: str
    email: str
    tenant_nombre: str
    expires_at: datetime
