import hashlib
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from main import app

TENANT_ID  = "00000000-0000-0000-0000-000000000010"
USER_ID    = "00000000-0000-0000-0000-000000000011"
CONFIG_ID  = "00000000-0000-0000-0000-000000000012"
_TEST_SECRET = "test-secret-key-for-unit-tests-32chars!!"


def _make_user(role: str = "super_admin") -> dict:
    return {
        "id": USER_ID,
        "tenant_id": TENANT_ID,
        "email": "admin@empresa.com",
        "first_name": "Ana",
        "last_name": "Admin",
        "role": role,
        "estado": "activo",
    }


def _make_config() -> dict:
    return {
        "id": CONFIG_ID,
        "tenant_id": TENANT_ID,
        "phone_number_id": "123456789",
        "business_account_id": "987654321",
        "verify_token": "my-verify-token",
        "mensaje_bienvenida": None,
        "horario_atencion": None,
        "is_active": True,
        "verificado_at": None,
        "created_at": "2026-05-12T00:00:00+00:00",
        "updated_at": "2026-05-12T00:00:00+00:00",
    }


def _jwt_for(user: dict) -> str:
    return jwt.encode({"sub": user["id"]}, _TEST_SECRET, algorithm="HS256")


def _mock_settings():
    s = MagicMock()
    s.secret_key = _TEST_SECRET
    s.encryption_key = "0" * 64
    s.meta_verify_token = "verify-secret"
    s.meta_app_secret = ""
    return s


@pytest.fixture
def client():
    app.dependency_overrides[get_settings] = _mock_settings
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_settings, None)


# ── GET /whatsapp/webhook (Meta challenge) ────────────────────────────────────

def test_verify_webhook_returns_challenge(client):
    with patch("app.routers.whatsapp.WhatsappService") as MockSvc:
        svc = MagicMock()
        svc.verify_webhook.return_value = "challenge-token-abc"
        MockSvc.return_value = svc

        r = client.get(
            "/whatsapp/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "correct-token",
                "hub.challenge": "challenge-token-abc",
            },
        )

    assert r.status_code == 200
    assert r.text == "challenge-token-abc"


# ── POST /whatsapp/webhook ─────────────────────────────────────────────────────

def test_receive_webhook_returns_event_received(client):
    payload = {
        "object": "whatsapp_business_account",
        "entry": [],
    }
    with patch("app.routers.whatsapp.WhatsappService") as MockSvc:
        svc = MagicMock()
        svc.validate_hmac.return_value = None
        svc.process_webhook = AsyncMock()
        MockSvc.return_value = svc

        r = client.post("/whatsapp/webhook", json=payload)

    assert r.status_code == 200
    assert r.json() == "EVENT_RECEIVED"


# ── GET /whatsapp/config ───────────────────────────────────────────────────────

def test_get_config_requires_super_admin(client):
    user = _make_user(role="rrhh")
    token = _jwt_for(user)

    with (
        patch("app.dependencies.auth.UserRepository") as MockUserRepo,
        patch("app.routers.whatsapp.WhatsappConfigRepository"),
        patch("app.routers.whatsapp.WhatsappSessionRepository"),
        patch("app.routers.whatsapp.WhatsappLogRepository"),
        patch("app.routers.whatsapp.UserRepository"),
        patch("app.routers.whatsapp.ReciboRepository"),
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockUserRepo.return_value = repo

        r = client.get("/whatsapp/config", headers={"Authorization": f"Bearer {token}"})

    assert r.status_code == 403


def test_get_config_returns_config(client):
    user = _make_user()
    token = _jwt_for(user)
    cfg = _make_config()

    with (
        patch("app.dependencies.auth.UserRepository") as MockUserRepo,
        patch("app.routers.whatsapp.WhatsappConfigRepository") as MockCfgRepo,
        patch("app.routers.whatsapp.WhatsappSessionRepository"),
        patch("app.routers.whatsapp.WhatsappLogRepository"),
        patch("app.routers.whatsapp.UserRepository"),
        patch("app.routers.whatsapp.ReciboRepository"),
    ):
        user_repo = AsyncMock()
        user_repo.get_by_id.return_value = user
        MockUserRepo.return_value = user_repo

        cfg_repo = AsyncMock()
        cfg_repo.get_by_tenant.return_value = cfg
        MockCfgRepo.return_value = cfg_repo

        r = client.get("/whatsapp/config", headers={"Authorization": f"Bearer {token}"})

    assert r.status_code == 200
    body = r.json()
    assert body["phone_number_id"] == "123456789"
    assert "access_token" not in body


# ── PUT /whatsapp/config ───────────────────────────────────────────────────────

def test_upsert_config_saves_config(client):
    user = _make_user()
    token = _jwt_for(user)
    cfg = _make_config()

    payload = {
        "phone_number_id": "123456789",
        "business_account_id": "987654321",
        "access_token": "EAA...token",
        "verify_token": "my-verify-token",
    }

    with (
        patch("app.dependencies.auth.UserRepository") as MockUserRepo,
        patch("app.routers.whatsapp.WhatsappConfigRepository") as MockCfgRepo,
        patch("app.routers.whatsapp.WhatsappSessionRepository"),
        patch("app.routers.whatsapp.WhatsappLogRepository"),
        patch("app.routers.whatsapp.UserRepository"),
        patch("app.routers.whatsapp.ReciboRepository"),
        patch("app.utils.encryption.encrypt", return_value="encrypted-token"),
    ):
        user_repo = AsyncMock()
        user_repo.get_by_id.return_value = user
        MockUserRepo.return_value = user_repo

        cfg_repo = AsyncMock()
        cfg_repo.upsert.return_value = cfg
        MockCfgRepo.return_value = cfg_repo

        r = client.put(
            "/whatsapp/config",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 200
    assert r.json()["phone_number_id"] == "123456789"
