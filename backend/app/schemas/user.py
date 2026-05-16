from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, computed_field


class UserSummary(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    role: str
    roles: list[str] = []
    estado: str
    avatar_url: str | None = None

    @computed_field
    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    model_config = {"from_attributes": True}


class UserMe(UserSummary):
    tenant_id: UUID | None = None
    last_login_at: datetime | None = None
    mfa_enabled: bool = False


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    # Normal login
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    user: UserSummary | None = None
    # MFA challenge required
    mfa_required: bool = False
    mfa_token: str | None = None


class ActivateResponse(TokenPair):
    user: UserSummary


class RefreshResponse(TokenPair):
    pass
