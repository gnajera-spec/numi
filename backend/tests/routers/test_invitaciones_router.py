from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import io

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from main import app

TENANT_ID        = "00000000-0000-0000-0000-000000000010"
USER_ID          = "00000000-0000-0000-0000-000000000011"
INVITACION_TOKEN = "aaaaaaaa-0000-0000-0000-000000000001"
_TEST_SECRET     = "test-secret-key-for-unit-tests-32chars!!"
_NOW             = "2026-05-15T10:00:00+00:00"
_FUTURE          = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()


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
    s.frontend_url = "http://localhost:5580"
    return s


@pytest.fixture
def client():
    app.dependency_overrides[get_settings] = _mock_settings
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_settings, None)


def _inv_creada() -> dict:
    return {
        "token": INVITACION_TOKEN,
        "email": "juan@empresa.com",
        "cuil": "20123456789",
        "link": f"http://localhost:5580/onboarding/{INVITACION_TOKEN}",
        "expires_at": _FUTURE,
    }


def _onboarding_info() -> dict:
    return {
        "cuil": "20123456789",
        "email": "juan@empresa.com",
        "tenant_nombre": "Acme SA",
        "expires_at": _FUTURE,
    }


# ── POST /admin/invitaciones/individual ───────────────────────────────────────

def test_invitar_individual_requires_auth(client):
    r = client.post("/admin/invitaciones/individual", json={"cuil": "20123456789", "email": "x@x.com"})
    assert r.status_code == 401


def test_invitar_individual_success(client):
    user = _make_admin()
    from app.schemas.invitaciones import InvitacionCreada
    inv_out = InvitacionCreada.model_validate(_inv_creada())

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.invitaciones.InvitacionService") as MockSvc,
        patch("app.routers.invitaciones.SmtpService") as MockSmtp,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        svc.invitar_individual.return_value = inv_out
        MockSvc.return_value = svc

        smtp = AsyncMock()
        smtp.send_invitation.return_value = True
        MockSmtp.return_value = smtp

        r = client.post(
            "/admin/invitaciones/individual",
            json={"cuil": "20123456789", "email": "juan@empresa.com"},
            headers=_auth(user),
        )

    assert r.status_code == 201
    data = r.json()
    assert data["cuil"] == "20123456789"
    assert data["token"] == INVITACION_TOKEN


def test_invitar_individual_forbidden_for_colaborador(client):
    user = _make_admin(role="colaborador")
    with patch("app.dependencies.auth.UserRepository") as MockRepo:
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        r = client.post(
            "/admin/invitaciones/individual",
            json={"cuil": "20123456789", "email": "x@x.com"},
            headers=_auth(user),
        )
    assert r.status_code == 403


def test_invitar_individual_conflict_returns_409(client):
    user = _make_admin()
    from fastapi import HTTPException

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.invitaciones.InvitacionService") as MockSvc,
        patch("app.routers.invitaciones.SmtpService"),
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        svc.invitar_individual.side_effect = HTTPException(409, "Ya existe una invitación pendiente para el CUIL")
        MockSvc.return_value = svc

        r = client.post(
            "/admin/invitaciones/individual",
            json={"cuil": "20123456789", "email": "juan@empresa.com"},
            headers=_auth(user),
        )
    assert r.status_code == 409


# ── POST /admin/invitaciones/lote ─────────────────────────────────────────────

def test_invitar_lote_success(client):
    user = _make_admin()
    from app.schemas.invitaciones import LoteResultado, InvitacionCreada
    lote_out = LoteResultado(exitosos=[InvitacionCreada.model_validate(_inv_creada())], errores=[])

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.invitaciones.InvitacionService") as MockSvc,
        patch("app.routers.invitaciones.SmtpService") as MockSmtp,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        svc.invitar_lote.return_value = lote_out
        MockSvc.return_value = svc

        smtp = AsyncMock()
        smtp.send_invitation.return_value = True
        MockSmtp.return_value = smtp

        r = client.post(
            "/admin/invitaciones/lote",
            json={"colaboradores": [{"cuil": "20123456789", "email": "juan@empresa.com"}]},
            headers=_auth(user),
        )

    assert r.status_code == 201
    data = r.json()
    assert len(data["exitosos"]) == 1
    assert data["errores"] == []


# ── POST /admin/invitaciones/lote/csv ─────────────────────────────────────────

def test_invitar_lote_csv_success(client):
    user = _make_admin()
    from app.schemas.invitaciones import LoteResultado, InvitacionCreada
    lote_out = LoteResultado(exitosos=[InvitacionCreada.model_validate(_inv_creada())], errores=[])
    csv_content = b"cuil,email\n20123456789,juan@empresa.com\n"

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.invitaciones.InvitacionService") as MockSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        svc.invitar_lote.return_value = lote_out
        MockSvc.return_value = svc

        r = client.post(
            "/admin/invitaciones/lote/csv",
            files={"file": ("colaboradores.csv", csv_content, "text/csv")},
            headers=_auth(user),
        )

    assert r.status_code == 201


def test_invitar_lote_csv_non_csv_returns_400(client):
    user = _make_admin()
    with patch("app.dependencies.auth.UserRepository") as MockRepo:
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        r = client.post(
            "/admin/invitaciones/lote/csv",
            files={"file": ("data.xlsx", b"not-a-csv", "application/octet-stream")},
            headers=_auth(user),
        )
    assert r.status_code == 400


def test_invitar_lote_csv_empty_returns_400(client):
    user = _make_admin()
    csv_content = b"cuil,email\n"

    with (
        patch("app.dependencies.auth.UserRepository") as MockRepo,
        patch("app.routers.invitaciones.InvitacionService") as MockSvc,
    ):
        repo = AsyncMock()
        repo.get_by_id.return_value = user
        MockRepo.return_value = repo

        svc = AsyncMock()
        MockSvc.return_value = svc
        # parse_csv is a static method called on the class — return empty list to trigger 400
        MockSvc.parse_csv.return_value = []

        r = client.post(
            "/admin/invitaciones/lote/csv",
            files={"file": ("vacio.csv", csv_content, "text/csv")},
            headers=_auth(user),
        )
    assert r.status_code == 400


# ── GET /onboarding/{token} ───────────────────────────────────────────────────

def test_get_onboarding_info_success(client):
    from app.schemas.invitaciones import OnboardingTokenInfo
    from datetime import datetime, timezone, timedelta
    info = OnboardingTokenInfo(
        cuil="20123456789",
        email="juan@empresa.com",
        tenant_nombre="Acme SA",
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )

    with patch("app.routers.invitaciones.InvitacionService") as MockSvc:
        svc = AsyncMock()
        svc.get_token_info.return_value = info
        MockSvc.return_value = svc

        r = client.get(f"/onboarding/{INVITACION_TOKEN}")

    assert r.status_code == 200
    data = r.json()
    assert data["cuil"] == "20123456789"
    assert data["tenant_nombre"] == "Acme SA"


def test_get_onboarding_info_not_found(client):
    from fastapi import HTTPException

    with patch("app.routers.invitaciones.InvitacionService") as MockSvc:
        svc = AsyncMock()
        svc.get_token_info.side_effect = HTTPException(404, "Invitación no encontrada")
        MockSvc.return_value = svc

        r = client.get("/onboarding/invalid-token")

    assert r.status_code == 404


# ── POST /onboarding/{token}/completar ────────────────────────────────────────

def test_completar_onboarding_success(client):
    with patch("app.routers.invitaciones.InvitacionService") as MockSvc:
        svc = AsyncMock()
        svc.completar_onboarding.return_value = {
            "message": "Registro completado exitosamente",
            "user_id": USER_ID,
        }
        MockSvc.return_value = svc

        r = client.post(
            f"/onboarding/{INVITACION_TOKEN}/completar",
            json={
                "nombre": "Juan",
                "apellido": "Pérez",
                "email": "juan@empresa.com",
                "nro_documento": "12345678",
                "password": "Segura123",
            },
        )

    assert r.status_code == 201
    assert r.json()["user_id"] == USER_ID


def test_completar_onboarding_email_conflict_returns_409(client):
    from fastapi import HTTPException

    with patch("app.routers.invitaciones.InvitacionService") as MockSvc:
        svc = AsyncMock()
        svc.completar_onboarding.side_effect = HTTPException(409, "El email ya está registrado")
        MockSvc.return_value = svc

        r = client.post(
            f"/onboarding/{INVITACION_TOKEN}/completar",
            json={
                "nombre": "Juan",
                "apellido": "Pérez",
                "email": "juan@empresa.com",
                "nro_documento": "12345678",
                "password": "Segura123",
            },
        )

    assert r.status_code == 409


def test_completar_onboarding_weak_password_returns_422(client):
    r = client.post(
        f"/onboarding/{INVITACION_TOKEN}/completar",
        json={
            "nombre": "Juan",
            "apellido": "Pérez",
            "email": "juan@empresa.com",
            "nro_documento": "12345678",
            "password": "short",
        },
    )
    assert r.status_code == 422
