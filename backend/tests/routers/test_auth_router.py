from unittest.mock import AsyncMock, patch

import bcrypt
import pytest
from fastapi.testclient import TestClient

from main import app

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


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


# ── POST /auth/login ─────────────────────────────────────────────────────────

def test_login_returns_200_with_tokens(client):
    user = _make_user()
    with (
        patch("app.routers.auth.UserRepository") as MockUserRepo,
        patch("app.routers.auth.TokenRepository") as MockTokenRepo,
    ):
        user_repo = AsyncMock()
        user_repo.get_by_email.return_value = user
        user_repo.update_last_login.return_value = None
        MockUserRepo.return_value = user_repo

        token_repo = AsyncMock()
        token_repo.create_refresh_token.return_value = None
        MockTokenRepo.return_value = token_repo

        response = client.post("/auth/login", json={"email": "test@example.com", "password": "Password1"})

    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


def test_login_returns_401_on_wrong_password(client):
    user = _make_user()
    with (
        patch("app.routers.auth.UserRepository") as MockUserRepo,
        patch("app.routers.auth.TokenRepository"),
    ):
        user_repo = AsyncMock()
        user_repo.get_by_email.return_value = user
        MockUserRepo.return_value = user_repo

        response = client.post("/auth/login", json={"email": "test@example.com", "password": "WrongPass1"})

    assert response.status_code == 401


def test_login_returns_422_on_invalid_email(client):
    response = client.post("/auth/login", json={"email": "not-an-email", "password": "Password1"})
    assert response.status_code == 422


# ── POST /auth/logout ────────────────────────────────────────────────────────

def test_logout_returns_204(client):
    with (
        patch("app.routers.auth.UserRepository"),
        patch("app.routers.auth.TokenRepository") as MockTokenRepo,
    ):
        token_repo = AsyncMock()
        token_repo.revoke_refresh_token.return_value = None
        MockTokenRepo.return_value = token_repo

        response = client.post("/auth/logout", json={"refresh_token": "sometoken"})

    assert response.status_code == 204


# ── GET /auth/me ─────────────────────────────────────────────────────────────

def test_me_returns_401_without_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 401
