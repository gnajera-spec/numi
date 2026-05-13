from unittest.mock import AsyncMock, MagicMock, patch

import bcrypt
import jwt
import pytest
import pyotp
from fastapi.testclient import TestClient

from app.core.config import get_settings
from main import app

USER_ID = "00000000-0000-0000-0000-000000000001"
TENANT_ID = "00000000-0000-0000-0000-000000000002"
_TEST_SECRET = "test-secret-key-for-unit-tests-32chars!!"
_TEST_ENC_KEY = "0" * 64


def _make_user(**kwargs) -> dict:
    base = {
        "id": USER_ID,
        "email": "admin@example.com",
        "password_hash": bcrypt.hashpw(b"Password1", bcrypt.gensalt()).decode(),
        "first_name": "Ana",
        "last_name": "Lopez",
        "role": "rrhh",
        "estado": "activo",
        "tenant_id": TENANT_ID,
        "avatar_url": None,
        "last_login_at": None,
        "mfa_enabled": False,
    }
    base.update(kwargs)
    return base


def _mock_settings():
    s = MagicMock()
    s.secret_key = _TEST_SECRET
    s.encryption_key = _TEST_ENC_KEY
    s.meta_verify_token = "verify"
    s.meta_app_secret = ""
    return s


def _jwt_for(user: dict) -> str:
    return jwt.encode(
        {"sub": user["id"], "tenant_id": user["tenant_id"], "role": user["role"]},
        _TEST_SECRET,
        algorithm="HS256",
    )


def _patch_auth(user: dict):
    return patch(
        "app.dependencies.auth.UserRepository",
        return_value=AsyncMock(get_by_id=AsyncMock(return_value=user)),
    )


@pytest.fixture
def client():
    app.dependency_overrides[get_settings] = _mock_settings
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_settings, None)


# ── GET /auth/mfa/setup ───────────────────────────────────────────────────────

def test_mfa_setup_returns_secret_and_qr(client):
    user = _make_user()
    token = _jwt_for(user)

    with (
        _patch_auth(user),
        patch("app.routers.auth.MfaRepository"),
        patch("app.routers.auth.UserRepository"),
        patch("app.routers.auth.TokenRepository"),
    ):
        response = client.get("/auth/mfa/setup", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert "secret" in body
    assert "qr_uri" in body
    assert "otpauth://" in body["qr_uri"]
    assert len(body["backup_codes"]) == 8


def test_mfa_setup_requires_auth(client):
    response = client.get("/auth/mfa/setup")
    assert response.status_code == 401


# ── POST /auth/mfa/enable ─────────────────────────────────────────────────────

def test_mfa_enable_returns_200_with_valid_code(client):
    user = _make_user()
    token = _jwt_for(user)
    secret = pyotp.random_base32()
    code = pyotp.TOTP(secret).now()

    with (
        _patch_auth(user),
        patch("app.routers.auth.MfaRepository") as MockMfaRepo,
        patch("app.routers.auth.UserRepository"),
        patch("app.routers.auth.TokenRepository"),
        patch("app.services.mfa_service.encrypt", return_value="enc"),
    ):
        mfa_repo = AsyncMock()
        mfa_repo.enable_mfa.return_value = None
        MockMfaRepo.return_value = mfa_repo

        response = client.post(
            "/auth/mfa/enable",
            json={"code": code, "secret": secret},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["mfa_enabled"] is True


def test_mfa_enable_returns_422_with_invalid_code(client):
    user = _make_user()
    token = _jwt_for(user)
    secret = pyotp.random_base32()

    with (
        _patch_auth(user),
        patch("app.routers.auth.MfaRepository"),
        patch("app.routers.auth.UserRepository"),
        patch("app.routers.auth.TokenRepository"),
    ):
        response = client.post(
            "/auth/mfa/enable",
            json={"code": "000000", "secret": secret},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 422


# ── POST /auth/mfa/disable ────────────────────────────────────────────────────

def test_mfa_disable_returns_200_with_valid_code(client):
    user = _make_user(mfa_enabled=True)
    token = _jwt_for(user)
    secret = pyotp.random_base32()
    code = pyotp.TOTP(secret).now()

    with (
        _patch_auth(user),
        patch("app.routers.auth.MfaRepository") as MockMfaRepo,
        patch("app.routers.auth.UserRepository"),
        patch("app.routers.auth.TokenRepository"),
        patch("app.services.mfa_service.decrypt", return_value=secret),
    ):
        mfa_repo = AsyncMock()
        mfa_repo.get_mfa_data.return_value = {
            "id": USER_ID,
            "mfa_enabled": True,
            "mfa_secret_encrypted": "enc",
        }
        mfa_repo.disable_mfa.return_value = None
        MockMfaRepo.return_value = mfa_repo

        response = client.post(
            "/auth/mfa/disable",
            json={"code": code},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["mfa_enabled"] is False


# ── POST /auth/mfa/challenge ──────────────────────────────────────────────────

def test_mfa_challenge_returns_tokens_with_valid_code(client):
    user = _make_user(mfa_enabled=True)
    secret = pyotp.random_base32()
    code = pyotp.TOTP(secret).now()

    mfa_token = jwt.encode(
        {"sub": USER_ID, "type": "mfa_challenge"},
        _TEST_SECRET,
        algorithm="HS256",
    )

    with (
        patch("app.routers.auth.MfaRepository") as MockMfaRepo,
        patch("app.routers.auth.UserRepository") as MockUR,
        patch("app.routers.auth.TokenRepository") as MockTR,
        patch("app.services.mfa_service.decrypt", return_value=secret),
        patch("app.services.mfa_service.get_settings", return_value=_mock_settings()),
    ):
        mfa_repo = AsyncMock()
        mfa_repo.get_mfa_data.return_value = {
            "id": USER_ID,
            "mfa_enabled": True,
            "mfa_secret_encrypted": "enc",
            "mfa_backup_codes_encrypted": None,
        }
        MockMfaRepo.return_value = mfa_repo

        ur = AsyncMock()
        ur.get_by_id.return_value = user
        ur.update_last_login.return_value = None
        MockUR.return_value = ur

        tr = AsyncMock()
        tr.create_refresh_token.return_value = None
        MockTR.return_value = tr

        response = client.post(
            "/auth/mfa/challenge",
            json={"mfa_token": mfa_token, "code": code},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"] is not None
    assert body["mfa_required"] is False


# ── POST /auth/login con MFA activo ──────────────────────────────────────────

def test_login_returns_mfa_required_when_mfa_enabled(client):
    user = _make_user(mfa_enabled=True)
    with (
        patch("app.routers.auth.UserRepository") as MockUserRepo,
        patch("app.routers.auth.TokenRepository"),
    ):
        ur = AsyncMock()
        ur.get_by_email.return_value = user
        MockUserRepo.return_value = ur

        response = client.post(
            "/auth/login",
            json={"email": "admin@example.com", "password": "Password1"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["mfa_required"] is True
    assert body["mfa_token"] is not None
    assert body.get("access_token") is None
