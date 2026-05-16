import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
import jwt
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.repositories.token_repository import TokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import ActivateRequest, LoginRequest
from app.schemas.user import ActivateResponse, LoginResponse, RefreshResponse, UserMe, UserSummary

_ACCESS_TTL = timedelta(hours=8)
_REFRESH_TTL = timedelta(days=30)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _generate_mfa_token(user: dict, secret: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "type": "mfa_challenge",
        "iat": now,
        "exp": now + timedelta(minutes=5),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def _generate_access_token(user: dict, secret: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "tenant_id": str(user["tenant_id"]) if user.get("tenant_id") else None,
        "role": user["role"],
        "iat": now,
        "exp": now + _ACCESS_TTL,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def _generate_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def _parse_dt(value: str) -> datetime:
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


class AuthService:
    def __init__(self, user_repo: UserRepository, token_repo: TokenRepository) -> None:
        self._users = user_repo
        self._tokens = token_repo
        self._settings = get_settings()

    async def login(self, data: LoginRequest) -> LoginResponse:
        user = await self._users.get_by_email(data.email)
        if not user or not user.get("password_hash"):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciales inválidas")

        if not bcrypt.checkpw(data.password.encode(), user["password_hash"].encode()):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciales inválidas")

        if user["estado"] != "activo":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Cuenta inactiva")

        if user.get("mfa_enabled"):
            mfa_token = _generate_mfa_token(user, self._settings.secret_key)
            return LoginResponse(mfa_required=True, mfa_token=mfa_token)

        token_pair = await self._issue_token_pair(user)
        await self._users.update_last_login(user["id"])

        return LoginResponse(user=UserSummary.model_validate(user), **token_pair)

    async def refresh(self, refresh_token: str) -> RefreshResponse:
        token_hash = _hash_token(refresh_token)
        record = await self._tokens.get_refresh_token(token_hash)

        if not record:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")

        if record.get("revoked_at"):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token revocado")

        if _parse_dt(record["expires_at"]) < datetime.now(timezone.utc):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expirado")

        user = await self._users.get_by_id(record["user_id"])
        if not user or user["estado"] != "activo":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario inactivo")

        await self._tokens.revoke_refresh_token(token_hash)
        token_pair = await self._issue_token_pair(user)

        return RefreshResponse(**token_pair)

    async def logout(self, refresh_token: str) -> None:
        token_hash = _hash_token(refresh_token)
        await self._tokens.revoke_refresh_token(token_hash)

    async def activate(self, data: ActivateRequest) -> ActivateResponse:
        token_hash = _hash_token(data.token)
        invite = await self._tokens.get_invite_token(token_hash)

        if not invite:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Token de invitación inválido")

        if invite.get("used_at") or invite.get("invalidated_at"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "El token ya fue utilizado")

        if _parse_dt(invite["expires_at"]) < datetime.now(timezone.utc):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "El token de invitación expiró")

        user = await self._users.get_by_id(invite["user_id"])
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

        if user["estado"] == "activo":
            raise HTTPException(status.HTTP_409_CONFLICT, "La cuenta ya fue activada")

        if user.get("tenant_id"):
            existing = await self._users.get_by_cuil_and_tenant(data.cuil, str(user["tenant_id"]))
            if existing and str(existing["id"]) != str(user["id"]):
                raise HTTPException(status.HTTP_409_CONFLICT, "El CUIL ya está registrado en este tenant")

        password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
        activated_user = await self._users.activate(
            user["id"],
            password_hash,
            first_name=data.first_name,
            cuil=data.cuil,
        )
        await self._tokens.use_invite_token(token_hash)

        token_pair = await self._issue_token_pair(activated_user)
        await self._users.update_last_login(activated_user["id"])

        return ActivateResponse(user=UserSummary.model_validate(activated_user), **token_pair)

    async def get_me(self, user_id: str | UUID) -> UserMe:
        user = await self._users.get_by_id_with_profile(user_id)
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
        return UserMe.model_validate(user)

    async def _issue_token_pair(self, user: dict) -> dict:
        access_token = _generate_access_token(user, self._settings.secret_key)
        refresh_token = _generate_refresh_token()
        token_hash = _hash_token(refresh_token)
        expires_at = datetime.now(timezone.utc) + _REFRESH_TTL
        await self._tokens.create_refresh_token(user["id"], token_hash, expires_at)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    async def switch_role(self, user_id: str, target_role: str) -> dict:
        """Emite un nuevo par de tokens con el rol activo cambiado.
        Solo permite roles que el usuario tenga asignados en su array roles[]."""
        user = await self._users.get_by_id_with_profile(user_id)
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

        allowed_roles: list[str] = user.get("roles") or [user.get("role", "")]
        if target_role not in allowed_roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"El rol '{target_role}' no está asignado a este usuario"
            )

        # Emitir tokens con el nuevo rol como rol primario
        user_with_role = {**user, "role": target_role}
        return await self._issue_token_pair(user_with_role)
