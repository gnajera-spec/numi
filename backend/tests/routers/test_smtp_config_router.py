from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from main import app

TENANT_ID    = "00000000-0000-0000-0000-000000000010"
USER_ID      = "00000000-0000-0000-0000-000000000011"
_TEST_SECRET = "test-secret-key-for-unit-tests-32chars!!"
_NOW         = "2026-05-15T10:00:00+00:00"


def _make_admin(role: str = "admin_empresa") -> dict:
    return {
        "id": USER_ID, "tenant_id": TENANT_ID,
        "email": "admin@empresa.com",
        "first_name": "Ana", "last_name": "López",
        "role": role, "estado": "activo",
    }


def _jwt_for(user: dict) -> str:
    return jwt.encode({"sub": user["id"]}, _TEST_SECRET, algorithm="HS256")


def _auth(user: dict) -> dict:
    return {"Authorization": f"Bearer {_jwt_for(user)}"}


def _mock_settings():
    s = MagicMock()
    s.secret_key = _TEST_SECRET
    s.encryption_key = "0" * 64
    s.meta_verify_token = "verify"
    s.meta_app_secret = ""
    return s


@pytest.fixture
def client():
    app.dependency_overrides[get_settings] = _mock_settings
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_settings, None)


def _smtp_out() -> dict:
    return {
        "host": "smtp.empresa.com",
        "port": 587,
        "username": "no-reply@empresa.com",
        "from_email": "no-reply@empresa.com",
        "from_name": "Empresa SA",
        "use_tls": True,
        "activo": True,
        "use_numi_smtp": False,
    }


def _smtp_in() -> dict:
    return {
        "host": "smtp.empresa.com",
        "port": 587,
        "username": "no-reply@empresa.com",
        "password": "secret123",
        "from_email": "no-reply@empresa.com",
        "from_name": "Empresa SA",
        "use_tls": True,
        "activo": True,
        "use_numi_smtp": False,
    }


# ── GET /admin/configuracion/smtp ─────────────────────────────────────────────

def test_get_smtp_config_requires_auth(client):
    r = client.get("/admin/configuracion/smtp")
    assert r.status_code == 401


def test_get_smtp_config_returns_config(client):
    user = _make_admin()
    from app.schemas.smtp_config import SmtpConfigOut
    smtp_out = SmtpConfigOut.model_validate(_smtp_out())

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.smtp_config.SmtpConfigRepository") as MockSmtpRepo,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        smtp_repo = AsyncMock()
        smtp_repo.get_by_tenant.return_value = _smtp_out()
        MockSmtpRepo.return_value = smtp_repo

        r = client.get("/admin/configuracion/smtp", headers=_auth(user))

    assert r.status_code == 200
    data = r.json()
    assert data["host"] == "smtp.empresa.com"
    assert data["port"] == 587


def test_get_smtp_config_returns_null_when_not_configured(client):
    user = _make_admin()

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.smtp_config.SmtpConfigRepository") as MockSmtpRepo,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        smtp_repo = AsyncMock()
        smtp_repo.get_by_tenant.return_value = None
        MockSmtpRepo.return_value = smtp_repo

        r = client.get("/admin/configuracion/smtp", headers=_auth(user))

    assert r.status_code == 200
    assert r.json() is None


def test_get_smtp_config_forbidden_for_rrhh(client):
    user = _make_admin(role="rrhh")
    with patch("app.dependencies.auth.UserRepository") as MockRepo:
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        r = client.get("/admin/configuracion/smtp", headers=_auth(user))
    assert r.status_code == 403


# ── PUT /admin/configuracion/smtp ─────────────────────────────────────────────

def test_upsert_smtp_config_success(client):
    user = _make_admin()
    from app.schemas.smtp_config import SmtpConfigOut

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.smtp_config.SmtpConfigRepository") as MockSmtpRepo,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        smtp_repo = AsyncMock()
        smtp_repo.upsert.return_value = _smtp_out()
        MockSmtpRepo.return_value = smtp_repo

        r = client.put(
            "/admin/configuracion/smtp",
            json=_smtp_in(),
            headers=_auth(user),
        )

    assert r.status_code == 200
    data = r.json()
    assert data["host"] == "smtp.empresa.com"
    assert "password" not in data  # nunca exponer password en respuesta


def test_upsert_smtp_config_requires_auth(client):
    r = client.put("/admin/configuracion/smtp", json=_smtp_in())
    assert r.status_code == 401


def test_upsert_smtp_config_forbidden_for_rrhh(client):
    user = _make_admin(role="rrhh")
    with patch("app.dependencies.auth.UserRepository") as MockRepo:
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        r = client.put("/admin/configuracion/smtp", json=_smtp_in(), headers=_auth(user))
    assert r.status_code == 403


# ── POST /admin/configuracion/smtp/test ──────────────────────────────────────

def test_test_smtp_config_success(client):
    user = _make_admin()

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.smtp_config.SmtpService") as MockSmtpSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        smtp_svc = AsyncMock()
        smtp_svc.test_connection.return_value = (True, "Conexión exitosa")
        MockSmtpSvc.return_value = smtp_svc

        r = client.post(
            "/admin/configuracion/smtp/test",
            json=_smtp_in(),
            headers=_auth(user),
        )

    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert "exitosa" in data["message"].lower()


def test_test_smtp_config_failure_returns_200_with_ok_false(client):
    user = _make_admin()

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.smtp_config.SmtpService") as MockSmtpSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        smtp_svc = AsyncMock()
        smtp_svc.test_connection.return_value = (False, "Error de autenticación: usuario o contraseña incorrectos")
        MockSmtpSvc.return_value = smtp_svc

        r = client.post(
            "/admin/configuracion/smtp/test",
            json=_smtp_in(),
            headers=_auth(user),
        )

    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is False
    assert "autenticación" in data["message"].lower()


def test_test_smtp_requires_auth(client):
    r = client.post("/admin/configuracion/smtp/test", json=_smtp_in())
    assert r.status_code == 401
