from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from main import app

TENANT_ID    = "00000000-0000-0000-0000-000000000010"
USER_ID      = "00000000-0000-0000-0000-000000000011"
COM_ID       = "00000000-0000-0000-0000-000000000020"
_TEST_SECRET = "test-secret-key-for-unit-tests-32chars!!"
_NOW         = "2026-05-12T10:00:00+00:00"


def _make_user(role: str = "rrhh") -> dict:
    return {
        "id": USER_ID,
        "tenant_id": TENANT_ID,
        "email": "rrhh@empresa.com",
        "first_name": "Ana",
        "last_name": "Garcia",
        "role": role,
        "estado": "activo",
    }


def _make_com_summary() -> dict:
    return {
        "id": COM_ID,
        "asunto": "Aviso importante",
        "tipo_segmento": "todos",
        "estado": "borrador",
        "total_destinatarios": 0,
        "enviado_at": None,
        "created_at": _NOW,
    }


def _make_com_out() -> dict:
    return {
        "id": COM_ID,
        "tenant_id": TENANT_ID,
        "asunto": "Aviso importante",
        "cuerpo": "Este es el cuerpo del aviso.",
        "tipo_segmento": "todos",
        "segmento_config": {},
        "requiere_confirmacion": False,
        "programado_at": None,
        "enviado_at": None,
        "estado": "borrador",
        "total_destinatarios": 0,
        "created_by": USER_ID,
        "created_at": _NOW,
        "updated_at": _NOW,
        "comunicacion_adjuntos": [],
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


# ── GET /comunicaciones — requires auth ───────────────────────────────────────

def test_list_comunicaciones_requires_auth(client):
    r = client.get("/comunicaciones")
    assert r.status_code == 401


def test_list_comunicaciones_colaborador_forbidden(client):
    user = _make_user(role="colaborador")
    token = _jwt_for(user)

    with patch("app.dependencies.auth.UserRepository") as MockRepo:
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        r = client.get("/comunicaciones", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


def test_list_comunicaciones_rrhh_ok(client):
    user = _make_user(role="rrhh")
    token = _jwt_for(user)

    from app.schemas.comunicaciones import ComunicacionSummary, PaginatedComunicaciones

    paginated = PaginatedComunicaciones(
        total=1, page=1, page_size=20, pages=1,
        items=[ComunicacionSummary.model_validate(_make_com_summary())],
    )

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.comunicaciones.ComunicacionService") as MockSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        svc.list_by_tenant.return_value = paginated
        MockSvc.return_value = svc

        r = client.get("/comunicaciones", headers={"Authorization": f"Bearer {token}"})

    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert data["items"][0]["asunto"] == "Aviso importante"


# ── POST /comunicaciones ──────────────────────────────────────────────────────

def test_create_comunicacion_ok(client):
    user = _make_user(role="rrhh")
    token = _jwt_for(user)

    from app.schemas.comunicaciones import ComunicacionOut

    com_out = ComunicacionOut.model_validate(_make_com_out())

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.comunicaciones.ComunicacionService") as MockSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        svc.create.return_value = com_out
        MockSvc.return_value = svc

        r = client.post(
            "/comunicaciones",
            json={"asunto": "Aviso importante", "cuerpo": "Este es el cuerpo del aviso.", "tipo_segmento": "todos"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 201
    data = r.json()
    assert data["asunto"] == "Aviso importante"
    assert data["estado"] == "borrador"


def test_create_comunicacion_validates_asunto_length(client):
    user = _make_user(role="rrhh")
    token = _jwt_for(user)

    with patch("app.dependencies.auth.UserRepository") as MockRepo:
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        r = client.post(
            "/comunicaciones",
            json={"asunto": "A" * 201, "cuerpo": "ok", "tipo_segmento": "todos"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 422


# ── POST /comunicaciones/{id}/enviar ─────────────────────────────────────────

def test_enviar_comunicacion_ok(client):
    user = _make_user(role="rrhh")
    token = _jwt_for(user)

    from app.schemas.comunicaciones import EnviarResponse

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.comunicaciones.ComunicacionService") as MockSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        svc.enviar.return_value = EnviarResponse(estado="enviando", total_destinatarios=50)
        MockSvc.return_value = svc

        r = client.post(
            f"/comunicaciones/{COM_ID}/enviar",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 202
    data = r.json()
    assert data["estado"] == "enviando"
    assert data["total_destinatarios"] == 50


# ── GET /comunicaciones/colaborador ──────────────────────────────────────────

def test_get_comunicaciones_colaborador_ok(client):
    user = _make_user(role="colaborador")
    token = _jwt_for(user)

    from app.schemas.comunicaciones import PaginatedComunicacionesColaborador

    paginated = PaginatedComunicacionesColaborador(
        total=0, page=1, page_size=20, pages=1, items=[]
    )

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.comunicaciones.ComunicacionService") as MockSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        svc.list_for_colaborador.return_value = paginated
        MockSvc.return_value = svc

        r = client.get(
            "/comunicaciones/colaborador",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 0


# ── POST /comunicaciones/{id}/confirmar ──────────────────────────────────────

def test_confirmar_ok(client):
    user = _make_user(role="colaborador")
    token = _jwt_for(user)

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.comunicaciones.ComunicacionService") as MockSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        svc.confirmar.return_value = _NOW
        MockSvc.return_value = svc

        r = client.post(
            f"/comunicaciones/{COM_ID}/confirmar",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 200
    data = r.json()
    assert data["confirmado_at"] == _NOW


# ── POST /comunicaciones/{id}/reenviar ───────────────────────────────────────

def test_reenviar_ok(client):
    user = _make_user(role="rrhh")
    token = _jwt_for(user)

    from app.schemas.comunicaciones import ReenviarResponse

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.comunicaciones.ComunicacionService") as MockSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        svc.reenviar.return_value = ReenviarResponse(reenviados=12)
        MockSvc.return_value = svc

        r = client.post(
            f"/comunicaciones/{COM_ID}/reenviar",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 202
    data = r.json()
    assert data["reenviados"] == 12
