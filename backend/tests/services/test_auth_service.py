import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import bcrypt
import pytest

from app.schemas.auth import ActivateRequest, LoginRequest
from app.services.auth_service import AuthService, _hash_token

USER_ID = "00000000-0000-0000-0000-000000000001"
TENANT_ID = "00000000-0000-0000-0000-000000000002"


def _make_user(**kwargs) -> dict:
    base = {
        "id": USER_ID,
        "email": "test@example.com",
        "password_hash": bcrypt.hashpw(b"Password1", bcrypt.gensalt()).decode(),
        "first_name": "Juan",
        "last_name": "Perez",
        "role": "colaborador",
        "estado": "activo",
        "tenant_id": TENANT_ID,
        "avatar_url": None,
        "last_login_at": None,
        "mfa_enabled": False,
    }
    base.update(kwargs)
    return base


def _make_service(user_repo=None, token_repo=None) -> AuthService:
    user_repo = user_repo or AsyncMock()
    token_repo = token_repo or AsyncMock()
    svc = AuthService(user_repo, token_repo)
    svc._settings = MagicMock(secret_key="test-secret")
    return svc


# ── login ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_returns_token_pair_on_valid_credentials():
    user = _make_user()
    user_repo = AsyncMock()
    user_repo.get_by_email.return_value = user
    user_repo.update_last_login.return_value = None
    token_repo = AsyncMock()
    token_repo.create_refresh_token.return_value = None

    svc = _make_service(user_repo, token_repo)
    result = await svc.login(LoginRequest(email="test@example.com", password="Password1"))

    assert result.access_token
    assert result.refresh_token
    assert result.user.email == "test@example.com"
    user_repo.update_last_login.assert_called_once()


@pytest.mark.asyncio
async def test_login_raises_401_on_wrong_password():
    from fastapi import HTTPException

    user = _make_user()
    user_repo = AsyncMock()
    user_repo.get_by_email.return_value = user
    svc = _make_service(user_repo)

    with pytest.raises(HTTPException) as exc:
        await svc.login(LoginRequest(email="test@example.com", password="WrongPass1"))
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_login_raises_401_on_unknown_email():
    from fastapi import HTTPException

    user_repo = AsyncMock()
    user_repo.get_by_email.return_value = None
    svc = _make_service(user_repo)

    with pytest.raises(HTTPException) as exc:
        await svc.login(LoginRequest(email="nobody@example.com", password="Password1"))
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_login_raises_403_on_inactive_user():
    from fastapi import HTTPException

    user = _make_user(estado="pendiente")
    user_repo = AsyncMock()
    user_repo.get_by_email.return_value = user
    svc = _make_service(user_repo)

    with pytest.raises(HTTPException) as exc:
        await svc.login(LoginRequest(email="test@example.com", password="Password1"))
    assert exc.value.status_code == 403


# ── refresh ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_refresh_rotates_token_pair():
    user = _make_user()
    plain = "sometoken"
    token_hash = _hash_token(plain)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    token_repo = AsyncMock()
    token_repo.get_refresh_token.return_value = {
        "user_id": user["id"],
        "expires_at": expires_at,
        "revoked_at": None,
    }
    user_repo = AsyncMock()
    user_repo.get_by_id.return_value = user
    svc = _make_service(user_repo, token_repo)

    result = await svc.refresh(plain)

    assert result.access_token
    assert result.refresh_token
    token_repo.revoke_refresh_token.assert_called_once_with(token_hash)


@pytest.mark.asyncio
async def test_refresh_raises_401_on_revoked_token():
    from fastapi import HTTPException

    token_repo = AsyncMock()
    token_repo.get_refresh_token.return_value = {
        "user_id": "uid",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "revoked_at": datetime.now(timezone.utc).isoformat(),
    }
    svc = _make_service(AsyncMock(), token_repo)

    with pytest.raises(HTTPException) as exc:
        await svc.refresh("anytoken")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_refresh_raises_401_on_expired_token():
    from fastapi import HTTPException

    token_repo = AsyncMock()
    token_repo.get_refresh_token.return_value = {
        "user_id": "uid",
        "expires_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
        "revoked_at": None,
    }
    svc = _make_service(AsyncMock(), token_repo)

    with pytest.raises(HTTPException) as exc:
        await svc.refresh("anytoken")
    assert exc.value.status_code == 401


# ── logout ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_logout_revokes_token():
    token_repo = AsyncMock()
    svc = _make_service(AsyncMock(), token_repo)
    plain = "somerefreshtoken"

    await svc.logout(plain)

    token_repo.revoke_refresh_token.assert_called_once_with(_hash_token(plain))


# ── activate ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_activate_sets_password_and_returns_tokens():
    invite_token = "invitetoken123"
    token_hash = _hash_token(invite_token)
    user = _make_user(estado="pendiente", password_hash=None, cuil=None)
    activated_user = _make_user(estado="activo")

    token_repo = AsyncMock()
    token_repo.get_invite_token.return_value = {
        "user_id": user["id"],
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        "used_at": None,
    }
    user_repo = AsyncMock()
    user_repo.get_by_id.return_value = user
    user_repo.get_by_cuil_and_tenant.return_value = None
    user_repo.activate.return_value = activated_user

    svc = _make_service(user_repo, token_repo)
    result = await svc.activate(
        ActivateRequest(
            token=invite_token,
            first_name="Juan",
            cuil="20123456789",
            password="Password1",
            password_confirm="Password1",
        )
    )

    assert result.access_token
    assert result.user.estado == "activo"
    token_repo.use_invite_token.assert_called_once_with(token_hash)


@pytest.mark.asyncio
async def test_activate_raises_400_on_used_invite():
    from fastapi import HTTPException

    token_repo = AsyncMock()
    token_repo.get_invite_token.return_value = {
        "user_id": "uid",
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        "used_at": datetime.now(timezone.utc).isoformat(),
    }
    svc = _make_service(AsyncMock(), token_repo)

    with pytest.raises(HTTPException) as exc:
        await svc.activate(
            ActivateRequest(
                token="tok",
                first_name="A",
                cuil="20123456789",
                password="Password1",
                password_confirm="Password1",
            )
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_activate_raises_409_on_duplicate_cuil():
    from fastapi import HTTPException

    other_id = "00000000-0000-0000-0000-000000000099"
    invite_token = "invitetoken"
    user = _make_user(estado="pendiente", password_hash=None)
    other_user = _make_user(id=other_id)

    token_repo = AsyncMock()
    token_repo.get_invite_token.return_value = {
        "user_id": user["id"],
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        "used_at": None,
    }
    user_repo = AsyncMock()
    user_repo.get_by_id.return_value = user
    user_repo.get_by_cuil_and_tenant.return_value = other_user

    svc = _make_service(user_repo, token_repo)

    with pytest.raises(HTTPException) as exc:
        await svc.activate(
            ActivateRequest(
                token=invite_token,
                first_name="Juan",
                cuil="20123456789",
                password="Password1",
                password_confirm="Password1",
            )
        )
    assert exc.value.status_code == 409
