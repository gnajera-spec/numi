from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.schemas.invitaciones import (
    CompletarOnboardingRequest,
    InvitarIndividualRequest,
    InvitarLoteItem,
)
from app.services.invitacion_service import InvitacionService

TENANT_ID   = "00000000-0000-0000-0000-000000000010"
USER_ID     = "00000000-0000-0000-0000-000000000011"
INVITACION_TOKEN = "aaaaaaaa-0000-0000-0000-000000000001"
FRONTEND_URL = "http://localhost:5580"


def _future() -> str:
    return (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()


def _past() -> str:
    return (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()


def _make_inv(**kwargs) -> dict:
    return {
        "id": "bbbbbbbb-0000-0000-0000-000000000001",
        "tenant_id": TENANT_ID,
        "cuil": "20123456789",
        "email": "juan@empresa.com",
        "token": INVITACION_TOKEN,
        "estado": "pendiente",
        "expires_at": _future(),
        "created_by": USER_ID,
        "completed_at": None,
        "tenants": {"nombre": "Acme SA"},
        **kwargs,
    }


def _make_service(
    inv_get_by_token=None,
    inv_get_by_cuil=None,
    inv_create=None,
    user_get_by_email=None,
    user_get_by_cuil=None,
    user_create=None,
) -> InvitacionService:
    inv_repo = AsyncMock()
    inv_repo.get_by_token.return_value = inv_get_by_token
    inv_repo.get_by_cuil_and_tenant.return_value = inv_get_by_cuil
    inv_repo.create.return_value = inv_create or _make_inv()
    inv_repo.mark_completed.return_value = None
    inv_repo.list_by_tenant.return_value = []

    user_repo = AsyncMock()
    user_repo.get_by_email.return_value = user_get_by_email
    user_repo.get_by_cuil_and_tenant.return_value = user_get_by_cuil
    user_repo.create.return_value = {
        "id": USER_ID,
        "email": "juan@empresa.com",
        "tenant_id": TENANT_ID,
    }
    if user_create is not None:
        user_repo.create.return_value = user_create

    tenant_repo = AsyncMock()
    tenant_repo.get.return_value = {"id": TENANT_ID, "nombre": "Acme SA"}

    return InvitacionService(inv_repo, user_repo, tenant_repo, FRONTEND_URL)


# ── invitar_individual ────────────────────────────────────────────────────────

class TestInvitarIndividual:
    @pytest.mark.asyncio
    async def test_invitar_individual_returns_creada(self):
        svc = _make_service()
        req = InvitarIndividualRequest(cuil="20123456789", email="juan@empresa.com")
        result = await svc.invitar_individual(TENANT_ID, USER_ID, req)
        assert result.cuil == "20123456789"
        assert result.email == "juan@empresa.com"
        assert FRONTEND_URL in result.link
        assert str(result.token) == INVITACION_TOKEN

    @pytest.mark.asyncio
    async def test_invitar_individual_duplicate_cuil_raises_409(self):
        svc = _make_service(inv_get_by_cuil=_make_inv())
        req = InvitarIndividualRequest(cuil="20123456789", email="otro@empresa.com")
        with pytest.raises(HTTPException) as exc:
            await svc.invitar_individual(TENANT_ID, USER_ID, req)
        assert exc.value.status_code == 409
        assert "invitación pendiente" in exc.value.detail

    @pytest.mark.asyncio
    async def test_invitar_individual_existing_user_raises_409(self):
        svc = _make_service(
            inv_get_by_cuil=None,
            user_get_by_cuil={"id": USER_ID, "cuil": "20123456789"},
        )
        req = InvitarIndividualRequest(cuil="20123456789", email="juan@empresa.com")
        with pytest.raises(HTTPException) as exc:
            await svc.invitar_individual(TENANT_ID, USER_ID, req)
        assert exc.value.status_code == 409
        assert "usuario activo" in exc.value.detail

    @pytest.mark.asyncio
    async def test_invitar_individual_link_contains_token(self):
        svc = _make_service()
        req = InvitarIndividualRequest(cuil="20123456789", email="juan@empresa.com")
        result = await svc.invitar_individual(TENANT_ID, USER_ID, req)
        assert f"/onboarding/{INVITACION_TOKEN}" in result.link


# ── invitar_lote ─────────────────────────────────────────────────────────────

class TestInvitarLote:
    @pytest.mark.asyncio
    async def test_lote_all_ok(self):
        svc = _make_service()
        items = [
            InvitarLoteItem(cuil="20123456789", email="a@e.com"),
            InvitarLoteItem(cuil="27987654321", email="b@e.com"),
        ]
        result = await svc.invitar_lote(TENANT_ID, USER_ID, items)
        assert len(result.exitosos) == 2
        assert len(result.errores) == 0

    @pytest.mark.asyncio
    async def test_lote_partial_error_continues(self):
        inv_repo = AsyncMock()
        call_count = 0

        async def side_effect_cuil(cuil, tenant_id):
            if cuil == "20123456789":
                return _make_inv()  # ya tiene invitación → error
            return None

        inv_repo.get_by_cuil_and_tenant.side_effect = side_effect_cuil
        inv_repo.create.return_value = _make_inv(cuil="27987654321", email="b@e.com")
        user_repo = AsyncMock()
        user_repo.get_by_email.return_value = None
        user_repo.get_by_cuil_and_tenant.return_value = None
        tenant_repo = AsyncMock()
        svc = InvitacionService(inv_repo, user_repo, tenant_repo, FRONTEND_URL)

        items = [
            InvitarLoteItem(cuil="20123456789", email="a@e.com"),
            InvitarLoteItem(cuil="27987654321", email="b@e.com"),
        ]
        result = await svc.invitar_lote(TENANT_ID, USER_ID, items)
        assert len(result.exitosos) == 1
        assert len(result.errores) == 1
        assert result.errores[0]["cuil"] == "20123456789"

    @pytest.mark.asyncio
    async def test_lote_empty_returns_empty_result(self):
        svc = _make_service()
        result = await svc.invitar_lote(TENANT_ID, USER_ID, [])
        assert result.exitosos == []
        assert result.errores == []


# ── parse_csv ─────────────────────────────────────────────────────────────────

class TestParseCsv:
    def test_parse_csv_valid(self):
        csv_content = b"cuil,email\n20123456789,a@e.com\n27987654321,b@e.com\n"
        items = InvitacionService.parse_csv(csv_content)
        assert len(items) == 2
        assert items[0].cuil == "20123456789"
        assert str(items[0].email) == "a@e.com"

    def test_parse_csv_uppercase_headers(self):
        csv_content = b"CUIL,EMAIL\n20123456789,a@e.com\n"
        items = InvitacionService.parse_csv(csv_content)
        assert len(items) == 1

    def test_parse_csv_empty_rows_skipped(self):
        csv_content = b"cuil,email\n,\n20123456789,a@e.com\n"
        items = InvitacionService.parse_csv(csv_content)
        assert len(items) == 1

    def test_parse_csv_no_valid_rows(self):
        csv_content = b"cuil,email\n"
        items = InvitacionService.parse_csv(csv_content)
        assert items == []

    def test_parse_csv_bom_header(self):
        csv_content = b"\xef\xbb\xbfcuil,email\n20123456789,a@e.com\n"
        items = InvitacionService.parse_csv(csv_content)
        assert len(items) == 1


# ── get_token_info ────────────────────────────────────────────────────────────

class TestGetTokenInfo:
    @pytest.mark.asyncio
    async def test_get_token_info_returns_info(self):
        svc = _make_service(inv_get_by_token=_make_inv())
        result = await svc.get_token_info(INVITACION_TOKEN)
        assert result.cuil == "20123456789"
        assert result.tenant_nombre == "Acme SA"

    @pytest.mark.asyncio
    async def test_get_token_info_not_found_raises_404(self):
        svc = _make_service(inv_get_by_token=None)
        with pytest.raises(HTTPException) as exc:
            await svc.get_token_info("nonexistent-token")
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_token_info_completed_raises_409(self):
        svc = _make_service(inv_get_by_token=_make_inv(estado="completada"))
        with pytest.raises(HTTPException) as exc:
            await svc.get_token_info(INVITACION_TOKEN)
        assert exc.value.status_code == 409
        assert "ya fue utilizado" in exc.value.detail

    @pytest.mark.asyncio
    async def test_get_token_info_expired_estado_raises_410(self):
        svc = _make_service(inv_get_by_token=_make_inv(estado="expirada"))
        with pytest.raises(HTTPException) as exc:
            await svc.get_token_info(INVITACION_TOKEN)
        assert exc.value.status_code == 410

    @pytest.mark.asyncio
    async def test_get_token_info_past_expires_at_raises_410(self):
        svc = _make_service(inv_get_by_token=_make_inv(estado="pendiente", expires_at=_past()))
        with pytest.raises(HTTPException) as exc:
            await svc.get_token_info(INVITACION_TOKEN)
        assert exc.value.status_code == 410


# ── completar_onboarding ──────────────────────────────────────────────────────

class TestCompletarOnboarding:
    def _valid_request(self) -> CompletarOnboardingRequest:
        return CompletarOnboardingRequest(
            nombre="Juan",
            apellido="Pérez",
            email="juan@empresa.com",
            nro_documento="12345678",
            password="Segura123",
        )

    @pytest.mark.asyncio
    async def test_completar_onboarding_creates_user_and_marks_completed(self):
        inv_repo = AsyncMock()
        inv_repo.get_by_token.return_value = _make_inv()
        inv_repo.mark_completed.return_value = None

        user_repo = AsyncMock()
        user_repo.get_by_email.return_value = None
        user_repo.get_by_cuil_and_tenant.return_value = None
        user_repo.create.return_value = {"id": USER_ID, "email": "juan@empresa.com", "tenant_id": TENANT_ID}

        tenant_repo = AsyncMock()
        svc = InvitacionService(inv_repo, user_repo, tenant_repo, FRONTEND_URL)

        result = await svc.completar_onboarding(INVITACION_TOKEN, self._valid_request())
        assert result["user_id"] == USER_ID
        inv_repo.mark_completed.assert_called_once_with(INVITACION_TOKEN)
        user_repo.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_completar_onboarding_email_taken_raises_409(self):
        svc = _make_service(
            inv_get_by_token=_make_inv(),
            user_get_by_email={"id": "other-user-id"},
        )
        with pytest.raises(HTTPException) as exc:
            await svc.completar_onboarding(INVITACION_TOKEN, self._valid_request())
        assert exc.value.status_code == 409
        assert "email" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_completar_onboarding_cuil_taken_raises_409(self):
        svc = _make_service(
            inv_get_by_token=_make_inv(),
            user_get_by_email=None,
            user_get_by_cuil={"id": "other-user-id"},
        )
        with pytest.raises(HTTPException) as exc:
            await svc.completar_onboarding(INVITACION_TOKEN, self._valid_request())
        assert exc.value.status_code == 409
        assert "CUIL" in exc.value.detail

    @pytest.mark.asyncio
    async def test_completar_onboarding_invalid_token_raises_404(self):
        svc = _make_service(inv_get_by_token=None)
        with pytest.raises(HTTPException) as exc:
            await svc.completar_onboarding("bad-token", self._valid_request())
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_completar_onboarding_hashes_password(self):
        import hashlib
        inv_repo = AsyncMock()
        inv_repo.get_by_token.return_value = _make_inv()
        inv_repo.mark_completed.return_value = None

        user_repo = AsyncMock()
        user_repo.get_by_email.return_value = None
        user_repo.get_by_cuil_and_tenant.return_value = None
        created_user = {}

        async def capture_create(tenant_id, data, **kwargs):
            created_user.update(data)
            return {"id": USER_ID, "email": data["email"], "tenant_id": tenant_id}

        user_repo.create.side_effect = capture_create
        tenant_repo = AsyncMock()
        svc = InvitacionService(inv_repo, user_repo, tenant_repo, FRONTEND_URL)

        req = self._valid_request()
        await svc.completar_onboarding(INVITACION_TOKEN, req)
        expected_hash = hashlib.sha256(req.password.encode()).hexdigest()
        assert created_user["password_hash"] == expected_hash
