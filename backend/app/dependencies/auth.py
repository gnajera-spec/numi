import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase._async.client import AsyncClient

from app.core.config import Settings, get_settings
from app.db.supabase import get_supabase
from app.repositories.user_repository import UserRepository

_bearer = HTTPBearer()


def _decode_token(token: str, secret: str) -> dict:
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncClient = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> dict:
    payload = _decode_token(credentials.credentials, settings.secret_key)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")

    user = await UserRepository(db).get_by_id(user_id)
    if not user or user["estado"] != "activo":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario inactivo")

    # JWT role takes precedence over DB role (supports switchRole)
    user = dict(user)
    if "role" in payload:
        user["role"] = payload["role"]

    return user


def require_role(*roles: str):
    async def _check(current_user: dict = Depends(get_current_user)) -> dict:
        user_roles: list[str] = current_user.get("roles") or [current_user.get("role", "")]
        if not any(r in user_roles for r in roles):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")
        return current_user

    return _check
