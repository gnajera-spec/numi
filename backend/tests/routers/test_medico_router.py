from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from main import app

TENANT_ID    = "00000000-0000-0000-0000-000000000010"
USER_ID      = "00000000-0000-0000-0000-000000000011"
MEDICO_ID    = "00000000-0000-0000-0000-000000000099"
ACC_ID       = "00000000-0000-0000-0000-000000000030"
PUESTO_ID    = "00000000-0000-0000-0000-000000000050"
_TEST_SECRET = "test-secret-key-for-unit-tests-32chars!!"
_NOW         = "2026-05-12T10:00:00+00:00"
_TODAY       = "2026-05-12"


def _make_user(role: str = "servicio_medico") -> dict:
    return {
        "id": MEDICO_ID,
        "tenant_id": TENANT_ID,
        "email": "medico@empresa.com",
        "nombre": "Dr",
        "apellido": "Lopez",
        "role": role,
        "estado": "activo",
    }


def _make_ficha_out() -> dict:
    return {
        "id": "00000000-0000-0000-0000-000000000020",
        "tenant_id": TENANT_ID,
        "user_id": USER_ID,
        "grupo_sanguineo": "O+",
        "factor_rh": "positivo",
        "alergias": None,
        "condiciones": None,
        "observaciones": None,
        "created_at": _NOW,
        "updated_at": _NOW,
    }


def _make_examen_out() -> dict:
    return {
        "id": "00000000-0000-0000-0000-000000000021",
        "tenant_id": TENANT_ID,
        "user_id": USER_ID,
        "tipo": "ingreso",
        "fecha": _TODAY,
        "resultado": None,
        "medico_responsable": "Dr. López",
        "storage_path": None,
        "created_by": MEDICO_ID,
        "created_at": _NOW,
    }


def _make_accidente_out() -> dict:
    return {
        "id": ACC_ID,
        "tenant_id": TENANT_ID,
        "user_id": USER_ID,
        "fecha_hora": _NOW,
        "lugar": "Planta baja",
        "descripcion": "Caída en escalera",
        "testigos": None,
        "numero_art": None,
        "estado": "abierto",
        "created_by": MEDICO_ID,
        "created_at": _NOW,
        "updated_at": _NOW,
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


# ── GET /medico/fichas ────────────────────────────────────────────────────────

def test_list_fichas_ok(client):
    user = _make_user()
    paginated = {"total": 0, "page": 1, "page_size": 20, "pages": 1, "items": []}
    with (
        patch("app.routers.medico.MedicoService.list_fichas", new=AsyncMock(return_value=paginated)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/medico/fichas", headers=_auth(user))
    assert resp.status_code == 200


def test_list_fichas_forbidden_for_rrhh(client):
    user = _make_user(role="rrhh")
    with patch("app.dependencies.auth.UserRepository") as mock_repo:
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/medico/fichas", headers=_auth(user))
    assert resp.status_code == 403


# ── GET /medico/fichas/{user_id} ──────────────────────────────────────────────

def test_get_ficha_ok(client):
    user = _make_user()
    ficha = _make_ficha_out()
    with (
        patch("app.routers.medico.MedicoService.get_ficha", new=AsyncMock(return_value=ficha)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get(f"/medico/fichas/{USER_ID}", headers=_auth(user))
    assert resp.status_code == 200


# ── PUT /medico/fichas/{user_id} ──────────────────────────────────────────────

def test_upsert_ficha_ok(client):
    user = _make_user()
    ficha = _make_ficha_out()
    with (
        patch("app.routers.medico.MedicoService.upsert_ficha", new=AsyncMock(return_value=ficha)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.put(
            f"/medico/fichas/{USER_ID}",
            json={"grupo_sanguineo": "O+"},
            headers=_auth(user),
        )
    assert resp.status_code == 200


# ── POST /medico/examenes/{user_id} ──────────────────────────────────────────

def test_create_examen_ok(client):
    user = _make_user()
    examen = _make_examen_out()
    with (
        patch("app.routers.medico.MedicoService.create_examen", new=AsyncMock(return_value=examen)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.post(
            f"/medico/examenes/{USER_ID}?tipo=ingreso&fecha=2026-05-01",
            headers=_auth(user),
        )
    assert resp.status_code == 201


# ── GET /medico/accidentes ────────────────────────────────────────────────────

def test_list_accidentes_ok(client):
    user = _make_user()
    paginated = {
        "total": 1,
        "page": 1,
        "page_size": 20,
        "pages": 1,
        "items": [_make_accidente_out()],
    }
    with (
        patch("app.routers.medico.MedicoService.list_accidentes", new=AsyncMock(return_value=paginated)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.get("/medico/accidentes", headers=_auth(user))
    assert resp.status_code == 200


# ── POST /medico/accidentes ───────────────────────────────────────────────────

def test_create_accidente_ok(client):
    user = _make_user()
    acc = _make_accidente_out()
    with (
        patch("app.routers.medico.MedicoService.create_accidente", new=AsyncMock(return_value=acc)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.post(
            "/medico/accidentes",
            json={
                "user_id": USER_ID,
                "fecha_hora": _NOW,
                "lugar": "Planta baja",
                "descripcion": "Caída",
            },
            headers=_auth(user),
        )
    assert resp.status_code == 201


# ── PATCH /medico/accidentes/{id} ─────────────────────────────────────────────

def test_patch_accidente_ok(client):
    user = _make_user()
    acc = {**_make_accidente_out(), "estado": "tratamiento"}
    with (
        patch("app.routers.medico.MedicoService.update_accidente", new=AsyncMock(return_value=acc)),
        patch("app.dependencies.auth.UserRepository") as mock_repo,
    ):
        mock_repo.return_value.get_by_id = AsyncMock(return_value=user)
        resp = client.patch(
            f"/medico/accidentes/{ACC_ID}",
            json={"estado": "tratamiento"},
            headers=_auth(user),
        )
    assert resp.status_code == 200
