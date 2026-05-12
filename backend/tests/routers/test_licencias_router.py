from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from main import app

TENANT_ID     = "00000000-0000-0000-0000-000000000010"
USER_ID       = "00000000-0000-0000-0000-000000000011"
TIPO_ID       = "00000000-0000-0000-0000-000000000020"
SOL_ID        = "00000000-0000-0000-0000-000000000030"
_TEST_SECRET  = "test-secret-key-for-unit-tests-32chars!!"


def _make_user(role: str = "colaborador") -> dict:
    return {
        "id": USER_ID,
        "tenant_id": TENANT_ID,
        "email": "colab@empresa.com",
        "first_name": "Juan",
        "last_name": "Perez",
        "role": role,
        "estado": "activo",
    }


def _make_tipo() -> dict:
    return {
        "id": TIPO_ID,
        "tenant_id": None,
        "codigo": "VAC",
        "nombre": "Vacaciones anuales",
        "descripcion": None,
        "requiere_certificado": False,
        "es_medica": False,
        "dias_maximos": None,
        "is_active": True,
    }


def _make_solicitud_out() -> dict:
    return {
        "id": SOL_ID,
        "numero_solicitud": "LIC-2026-00001",
        "tipo_licencia": {"id": TIPO_ID, "codigo": "VAC", "nombre": "Vacaciones anuales"},
        "fecha_inicio": "2026-06-01",
        "fecha_fin": "2026-06-05",
        "dias_habiles": 5,
        "estado": "pendiente",
        "comentario_empleado": None,
        "comentario_rrhh": None,
        "revisado_por": None,
        "revisado_at": None,
        "canal": "portal",
        "documentos": [],
        "created_at": "2026-06-01T00:00:00+00:00",
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


def _patch_auth(role: str = "colaborador"):
    user = _make_user(role)
    return patch("app.dependencies.auth.UserRepository", return_value=AsyncMock(get_by_id=AsyncMock(return_value=user)))


# ── GET /licencias/tipos ──────────────────────────────────────────────────────

def test_list_tipos_requires_auth(client):
    r = client.get("/licencias/tipos")
    assert r.status_code == 401


def test_list_tipos_returns_list(client):
    user = _make_user()
    token = _jwt_for(user)

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.licencias.LicenciaService") as MockSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        from app.schemas.licencias import TipoLicenciaOut
        svc.list_tipos.return_value = [TipoLicenciaOut.model_validate(_make_tipo())]
        MockSvc.return_value = svc

        r = client.get("/licencias/tipos", headers={"Authorization": f"Bearer {token}"})

    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["codigo"] == "VAC"


# ── POST /licencias/solicitudes ───────────────────────────────────────────────

def test_create_solicitud_success(client):
    user = _make_user()
    token = _jwt_for(user)
    expected = _make_solicitud_out()

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.licencias.LicenciaService") as MockSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        from app.schemas.licencias import SolicitudLicenciaOut
        svc.create_solicitud.return_value = SolicitudLicenciaOut(**expected)
        MockSvc.return_value = svc

        r = client.post(
            "/licencias/solicitudes",
            json={
                "tipo_licencia_id": TIPO_ID,
                "fecha_inicio": "2026-06-01",
                "fecha_fin": "2026-06-05",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 201
    assert r.json()["numero_solicitud"] == "LIC-2026-00001"


# ── POST /licencias/solicitudes/{id}/aprobar ──────────────────────────────────

def test_aprobar_requires_rrhh(client):
    user = _make_user(role="colaborador")
    token = _jwt_for(user)

    with patch("app.dependencies.auth.UserRepository") as MockRepo:
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        r = client.post(
            f"/licencias/solicitudes/{SOL_ID}/aprobar",
            json={},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 403


def test_aprobar_solicitud_success(client):
    user = _make_user(role="rrhh")
    token = _jwt_for(user)
    expected = {**_make_solicitud_out(), "estado": "aprobada"}

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.licencias.LicenciaService") as MockSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        from app.schemas.licencias import SolicitudLicenciaOut
        svc.aprobar_solicitud.return_value = SolicitudLicenciaOut(**expected)
        MockSvc.return_value = svc

        r = client.post(
            f"/licencias/solicitudes/{SOL_ID}/aprobar",
            json={"comentario": "OK"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 200
    assert r.json()["estado"] == "aprobada"


# ── POST /licencias/solicitudes/{id}/rechazar ─────────────────────────────────

def test_rechazar_solicitud_success(client):
    user = _make_user(role="rrhh")
    token = _jwt_for(user)
    expected = {**_make_solicitud_out(), "estado": "rechazada", "comentario_rrhh": "Sin cupo"}

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.licencias.LicenciaService") as MockSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        from app.schemas.licencias import SolicitudLicenciaOut
        svc.rechazar_solicitud.return_value = SolicitudLicenciaOut(**expected)
        MockSvc.return_value = svc

        r = client.post(
            f"/licencias/solicitudes/{SOL_ID}/rechazar",
            json={"comentario": "Sin cupo"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 200
    assert r.json()["estado"] == "rechazada"


def test_rechazar_requires_comentario(client):
    user = _make_user(role="rrhh")
    token = _jwt_for(user)

    with patch("app.dependencies.auth.UserRepository") as MockRepo:
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        r = client.post(
            f"/licencias/solicitudes/{SOL_ID}/rechazar",
            json={},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 422


# ── GET /licencias/saldo ──────────────────────────────────────────────────────

def test_get_saldo_returns_list(client):
    user = _make_user()
    token = _jwt_for(user)

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.licencias.LicenciaService") as MockSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        svc.get_saldo.return_value = []
        MockSvc.return_value = svc

        r = client.get("/licencias/saldo", headers={"Authorization": f"Bearer {token}"})

    assert r.status_code == 200
    assert r.json() == []
