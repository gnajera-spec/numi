from pydantic import BaseModel, EmailStr, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ActivateRequest(BaseModel):
    token: str
    first_name: str
    cuil: str
    password: str
    password_confirm: str

    @field_validator("cuil")
    @classmethod
    def cuil_format(cls, v: str) -> str:
        digits = v.replace("-", "").replace(" ", "")
        if not digits.isdigit() or len(digits) != 11:
            raise ValueError("El CUIL debe tener 11 dígitos sin guiones")
        return digits

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        if not any(c.isupper() for c in v):
            raise ValueError("La contraseña debe tener al menos una mayúscula")
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe tener al menos un número")
        return v

    def model_post_init(self, __context: object) -> None:
        if self.password != self.password_confirm:
            raise ValueError("Las contraseñas no coinciden")


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


# ── MFA ──────────────────────────────────────────────────────────────────────

class MfaSetupResponse(BaseModel):
    secret: str
    qr_uri: str
    backup_codes: list[str]


class MfaEnableRequest(BaseModel):
    code: str
    secret: str


class MfaChallengeRequest(BaseModel):
    mfa_token: str
    code: str


class MfaDisableRequest(BaseModel):
    code: str


class MfaStatusResponse(BaseModel):
    mfa_enabled: bool
