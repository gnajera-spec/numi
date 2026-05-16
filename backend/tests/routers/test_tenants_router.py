from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from main import app

TENANT_ID    = "00000000-0000-0000-0000-000000000010"
ADMIN_ID     = "00000000-0000-0000-0000-000000000099"
SEDE_ID      = "00000000-0000-0000-0000-000000000020"
DEPTO_ID     = "00000000-0000-0000-0000-000000000030"
PUESTO_ID    = "00000000-0000-0000-0000-000000000040"
_TEST_SECRET = "test-secret-key-for-unit-tests-32chars!!"
_NOW         = "2026-05-13T10:00:00+00:00"


def _make_user(role: str = "admin_empresa") -> dict:
    return {
        "id": ADMIN_ID, "tenant_id": TENANT_ID, "email": "admin@acme.com",
        "nombre": "Juan", "apellido": "Pérez", "role": role, "estado": "activo",
    }


def _super_user() -> dict:
    return {
        "id": "00000000-0000-0000-0000-000000000001",
        "tenant_id": None, "email": "super@hrconnect.app",
        "nombre": "Super", "apellido": "Admin", "role": "super_admin", "estado": "activo",
    }


def _jwt_for(user: dict) -> str:
    return jwt.encode({"sub": user["id"]}, _TEST_SECRET, algorithm="HS256")


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


def _auth(user: dict) -> dict:
    return {"Authorization": f"Bearer {_jwt_for(user)}"}


_TENANT_OUT = {
    "id": TENANT_ID, "nombre": "Acme SA", "nombre_corto": "Acme",
    "cuit": "30123456789", "subdominio": "acme", "plan": "starter",
    "estado": "activo", "logo_url": None, "color_primario": None,
    "whatsapp_numero": None, "max_colaboradores": 100,
    "created_at": _NOW, "updated_at": _NOW,
}

_PAGINATED_TENANTS = {
    "total": 1, "page": 1, "page_size": 20, "pages": 1,
    "items": [{"id": TENANT_ID, "nombre": "Acme SA", "nombre_corto": "Acme",
               "subdominio": "acme", "plan": "starter", "estado": "activo",
               "logo_url": None, "color_primario": None}],
}

_SEDE_OUT = {
    "id": SEDE_ID, "tenant_id": TENANT_ID, "nombre": "Casa Central",
    "direccion": None, "ciudad": None, "provincia": None,
    "is_active": True, "created_at": _NOW, "updated_at": _NOW,
}

_DEPTO_OUT = {
    "id": DEPTO_ID, "tenant_id": TENANT_ID, "nombre": "Tecnología",
    "padre_id": None, "is_active": True, "hijos": [],
    "created_at": _NOW, "updated_at": _NOW,
}

_PUESTO_OUT = {
    "id": PUESTO_ID, "tenant_id": TENANT_ID, "nombre": "Developer",
    "descripcion": None, "meses_vigencia_aptitud": None,
    "is_active": True, "created_at": _NOW, "updated_at": _NOW,
}


# ── GET /tenants (super_admin) ────────────────────────────────────────────────

def test_list_tenants_super_admin_ok(client):
    user = _super_user()
    with (
        patch("app.routers.tenants.TenantService.list_tenants",
              new=AsyncMock(return_value=_PAGINATED_TENANTS)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/tenants", headers=_auth(user))
    assert resp.status_code == 200


def test_list_tenants_forbidden_for_admin_empresa(client):
    user = _make_user(role="admin_empresa")
    with patch("app.dependencies.auth.UserRepository") as mock_repo:
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/tenants", headers=_auth(user))
    assert resp.status_code == 403


# ── POST /tenants ─────────────────────────────────────────────────────────────

def test_create_tenant_ok(client):
    user = _super_user()
    body = {
        "nombre": "Acme SA", "nombre_corto": "Acme", "cuit": "30123456789",
        "subdominio": "acme", "plan": "starter",
        "admin_email": "admin@acme.com", "admin_first_name": "Juan", "admin_last_name": "Pérez",
    }
    create_response = {**_TENANT_OUT, "admin_email": "admin@acme.com", "initial_password": "TmpPass123!"}
    with (
        patch("app.routers.tenants.TenantService.create_tenant",
              new=AsyncMock(return_value=create_response)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.post("/tenants", json=body, headers=_auth(user))
    assert resp.status_code == 201
    assert resp.json()["admin_email"] == "admin@acme.com"


# ── GET /tenants/me ───────────────────────────────────────────────────────────

def test_get_tenant_me_ok(client):
    user = _make_user(role="admin_empresa")
    with (
        patch("app.routers.tenants.TenantService.get_tenant",
              new=AsyncMock(return_value=_TENANT_OUT)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/tenants/me", headers=_auth(user))
    assert resp.status_code == 200
    assert resp.json()["nombre"] == "Acme SA"


def test_get_tenant_me_forbidden_for_colaborador(client):
    user = _make_user(role="colaborador")
    with patch("app.dependencies.auth.UserRepository") as mock_repo:
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/tenants/me", headers=_auth(user))
    assert resp.status_code == 403


# ── PATCH /tenants/me/branding ────────────────────────────────────────────────

def test_update_branding_ok(client):
    user = _make_user(role="admin_empresa")
    with (
        patch("app.routers.tenants.TenantService.update_branding",
              new=AsyncMock(return_value=_TENANT_OUT)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.patch("/tenants/me/branding",
                            json={"color_primario": "#FF0000"}, headers=_auth(user))
    assert resp.status_code == 200


# ── GET /sedes ────────────────────────────────────────────────────────────────

def test_list_sedes_ok(client):
    user = _make_user()
    paginated = {"total": 1, "page": 1, "page_size": 50, "pages": 1, "items": [_SEDE_OUT]}
    with (
        patch("app.routers.tenants.TenantService.list_sedes",
              new=AsyncMock(return_value=paginated)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/sedes", headers=_auth(user))
    assert resp.status_code == 200


def test_create_sede_ok(client):
    user = _make_user()
    with (
        patch("app.routers.tenants.TenantService.create_sede",
              new=AsyncMock(return_value=_SEDE_OUT)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.post("/sedes", json={"nombre": "Casa Central"}, headers=_auth(user))
    assert resp.status_code == 201
    assert resp.json()["nombre"] == "Casa Central"


def test_create_sede_forbidden_for_rrhh(client):
    user = _make_user(role="rrhh")
    with patch("app.dependencies.auth.UserRepository") as mock_repo:
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.post("/sedes", json={"nombre": "Nueva"}, headers=_auth(user))
    assert resp.status_code == 403


# ── GET /departamentos ────────────────────────────────────────────────────────

def test_list_departamentos_ok(client):
    user = _make_user()
    with (
        patch("app.routers.tenants.TenantService.list_departamentos",
              new=AsyncMock(return_value=[_DEPTO_OUT])),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/departamentos", headers=_auth(user))
    assert resp.status_code == 200
    assert resp.json()[0]["nombre"] == "Tecnología"


def test_create_departamento_ok(client):
    user = _make_user()
    with (
        patch("app.routers.tenants.TenantService.create_departamento",
              new=AsyncMock(return_value=_DEPTO_OUT)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.post("/departamentos", json={"nombre": "Tecnología"}, headers=_auth(user))
    assert resp.status_code == 201


# ── GET /puestos ──────────────────────────────────────────────────────────────

def test_list_puestos_ok(client):
    user = _make_user()
    paginated = {"total": 1, "page": 1, "page_size": 50, "pages": 1, "items": [_PUESTO_OUT]}
    with (
        patch("app.routers.tenants.TenantService.list_puestos",
              new=AsyncMock(return_value=paginated)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/puestos", headers=_auth(user))
    assert resp.status_code == 200


def test_create_puesto_ok(client):
    user = _make_user()
    with (
        patch("app.routers.tenants.TenantService.create_puesto",
              new=AsyncMock(return_value=_PUESTO_OUT)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.post("/puestos", json={"nombre": "Developer"}, headers=_auth(user))
    assert resp.status_code == 201


# ── GET /convenios ────────────────────────────────────────────────────────────

def test_list_convenios_ok(client):
    user = _make_user()
    convenio = {
        "id": "00000000-0000-0000-0000-000000000050", "tenant_id": TENANT_ID,
        "nombre": "SMATA", "descripcion": None, "is_active": True,
        "created_at": _NOW, "updated_at": _NOW,
    }
    with (
        patch("app.routers.tenants.TenantService.list_convenios",
              new=AsyncMock(return_value=[convenio])),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/convenios", headers=_auth(user))
    assert resp.status_code == 200
    assert resp.json()[0]["nombre"] == "SMATA"


def test_create_convenio_ok(client):
    user = _make_user()
    convenio = {
        "id": "00000000-0000-0000-0000-000000000050", "tenant_id": TENANT_ID,
        "nombre": "SMATA", "descripcion": None, "is_active": True,
        "created_at": _NOW, "updated_at": _NOW,
    }
    with (
        patch("app.routers.tenants.TenantService.create_convenio",
              new=AsyncMock(return_value=convenio)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.post("/convenios", json={"nombre": "SMATA"}, headers=_auth(user))
    assert resp.status_code == 201
