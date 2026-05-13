from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from main import app

TENANT_ID    = "00000000-0000-0000-0000-000000000010"
RRHH_ID      = "00000000-0000-0000-0000-000000000099"
_TEST_SECRET = "test-secret-key-for-unit-tests-32chars!!"
_NOW         = "2026-05-12T10:00:00+00:00"


def _make_user(role: str = "rrhh") -> dict:
    return {
        "id": RRHH_ID,
        "tenant_id": TENANT_ID,
        "email": "rrhh@empresa.com",
        "nombre": "Ana",
        "apellido": "Martínez",
        "role": role,
        "estado": "activo",
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


_DASHBOARD_DATA = {
    "headcount": 42,
    "licencias_activas_hoy": 3,
    "licencias_pendientes_aprobacion": 2,
    "vencimientos_proximos_30d": 5,
    "recibos_sin_firmar": 8,
    "comunicados_sin_confirmar": 14,
}

_HEADCOUNT_DATA = {
    "total": 42,
    "por_sede": [{"sede": "Casa Central", "count": 30}],
    "por_departamento": [{"departamento": "Tecnología", "count": 15}],
}

_TENDENCIA_DATA = {
    "tendencia": [
        {"mes": "2026-04", "total": 5, "aprobadas": 4, "rechazadas": 1, "pendientes": 0},
        {"mes": "2026-05", "total": 3, "aprobadas": 2, "rechazadas": 0, "pendientes": 1},
    ]
}


# ── GET /reportes/dashboard ───────────────────────────────────────────────────

def test_get_dashboard_ok(client):
    user = _make_user()
    with (
        patch("app.routers.reportes.ReporteService.get_dashboard_kpis",
              new=AsyncMock(return_value=_DASHBOARD_DATA)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/reportes/dashboard", headers=_auth(user))
    assert resp.status_code == 200
    data = resp.json()
    assert data["headcount"] == 42
    assert data["licencias_pendientes_aprobacion"] == 2


def test_get_dashboard_forbidden_for_colaborador(client):
    user = _make_user(role="colaborador")
    with patch("app.dependencies.auth.UserRepository") as mock_repo:
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/reportes/dashboard", headers=_auth(user))
    assert resp.status_code == 403


def test_get_dashboard_unauthenticated(client):
    resp = client.get("/reportes/dashboard")
    assert resp.status_code == 401


# ── GET /reportes/headcount ───────────────────────────────────────────────────

def test_get_headcount_ok(client):
    user = _make_user()
    with (
        patch("app.routers.reportes.ReporteService.get_headcount_distribucion",
              new=AsyncMock(return_value=_HEADCOUNT_DATA)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/reportes/headcount", headers=_auth(user))
    assert resp.status_code == 200
    assert resp.json()["total"] == 42


def test_get_headcount_admin_empresa_allowed(client):
    user = _make_user(role="admin_empresa")
    with (
        patch("app.routers.reportes.ReporteService.get_headcount_distribucion",
              new=AsyncMock(return_value=_HEADCOUNT_DATA)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/reportes/headcount", headers=_auth(user))
    assert resp.status_code == 200


# ── GET /reportes/licencias ───────────────────────────────────────────────────

def test_get_tendencia_licencias_ok(client):
    user = _make_user()
    with (
        patch("app.routers.reportes.ReporteService.get_tendencia_licencias",
              new=AsyncMock(return_value=_TENDENCIA_DATA)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/reportes/licencias?meses=2", headers=_auth(user))
    assert resp.status_code == 200
    assert "tendencia" in resp.json()


# ── GET /reportes/export/licencias ───────────────────────────────────────────

def test_export_licencias_returns_csv(client):
    user = _make_user()
    csv_text = "numero_solicitud,colaborador\nLIC-2026-00001,García Juan\n"
    with (
        patch("app.routers.reportes.ReporteService.export_licencias_csv",
              new=AsyncMock(return_value=csv_text)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/reportes/export/licencias", headers=_auth(user))
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "LIC-2026-00001" in resp.text


def test_export_licencias_invalid_estado(client):
    user = _make_user()
    with patch("app.dependencies.auth.UserRepository") as mock_repo:
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get(
            "/reportes/export/licencias?estado=invalido", headers=_auth(user)
        )
    assert resp.status_code == 422


# ── GET /reportes/export/comunicaciones ──────────────────────────────────────

def test_export_comunicaciones_returns_csv(client):
    user = _make_user()
    csv_text = "titulo,tipo\nAviso importante,general\n"
    with (
        patch("app.routers.reportes.ReporteService.export_comunicaciones_csv",
              new=AsyncMock(return_value=csv_text)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/reportes/export/comunicaciones", headers=_auth(user))
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
