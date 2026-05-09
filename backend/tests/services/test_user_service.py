from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.users import BajaRequest, CreateUserRequest, UpdateUserRequest
from app.services.user_service import UserService

TENANT_ID = "00000000-0000-0000-0000-000000000010"
USER_ID = "00000000-0000-0000-0000-000000000001"
RRHH_ID = "00000000-0000-0000-0000-000000000099"


def _make_user(**kwargs) -> dict:
    base = {
        "id": USER_ID,
        "email": "colab@example.com",
        "first_name": "Ana",
        "last_name": "Lopez",
        "role": "colaborador",
        "estado": "activo",
        "tenant_id": TENANT_ID,
        "avatar_url": None,
        "last_login_at": None,
        "mfa_enabled": False,
        "cuil": "20123456789",
        "whatsapp_numero_masked": "+54****5678",
        "activated_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "colaborador_perfil": None,
    }
    base.update(kwargs)
    return base


def _make_rrhh(**kwargs) -> dict:
    base = {
        "id": RRHH_ID,
        "email": "rrhh@example.com",
        "first_name": "Carlos",
        "last_name": "Gil",
        "role": "rrhh",
        "estado": "activo",
        "tenant_id": TENANT_ID,
        "avatar_url": None,
    }
    base.update(kwargs)
    return base


def _make_svc(user_repo=None, token_repo=None, col_repo=None) -> UserService:
    return UserService(
        user_repo or AsyncMock(),
        token_repo or AsyncMock(),
        col_repo or AsyncMock(),
    )


# ── list_users ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_users_returns_paginated_result():
    user_repo = AsyncMock()
    user_repo.list_users.return_value = ([_make_user()], 1)
    svc = _make_svc(user_repo)

    result = await svc.list_users(TENANT_ID, page=1, page_size=20)

    assert result.pagination.total == 1
    assert len(result.data) == 1
    assert result.pagination.pages == 1


# ── create_user ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_user_creates_profile_for_colaborador():
    user_repo = AsyncMock()
    user_repo.get_by_email.return_value = None
    user_repo.get_by_cuil_and_tenant.return_value = None
    user_repo.create.return_value = _make_user()
    user_repo.get_by_id_with_profile.return_value = _make_user()

    token_repo = AsyncMock()
    col_repo = AsyncMock()

    svc = _make_svc(user_repo, token_repo, col_repo)

    data = CreateUserRequest(
        email="nuevo@example.com",
        first_name="Juan",
        last_name="Perez",
        cuil="20123456789",
        role="colaborador",
        whatsapp_numero="+5491112345678",
    )
    result = await svc.create_user(TENANT_ID, RRHH_ID, data)

    col_repo.create.assert_called_once()
    token_repo.create_invite_token.assert_called_once()
    assert result.first_name == "Ana"  # from mocked user


@pytest.mark.asyncio
async def test_create_user_raises_409_on_duplicate_email():
    from fastapi import HTTPException

    user_repo = AsyncMock()
    user_repo.get_by_email.return_value = _make_user()
    svc = _make_svc(user_repo)

    with pytest.raises(HTTPException) as exc:
        await svc.create_user(
            TENANT_ID,
            RRHH_ID,
            CreateUserRequest(
                email="colab@example.com",
                first_name="Juan",
                last_name="Perez",
                cuil="20987654321",
                role="colaborador",
                whatsapp_numero="+5491112345678",
            ),
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_create_user_no_profile_for_rrhh_role():
    user_repo = AsyncMock()
    user_repo.get_by_email.return_value = None
    user_repo.get_by_cuil_and_tenant.return_value = None
    rrhh_user = _make_user(role="rrhh")
    user_repo.create.return_value = rrhh_user
    user_repo.get_by_id_with_profile.return_value = rrhh_user

    col_repo = AsyncMock()
    svc = _make_svc(user_repo, AsyncMock(), col_repo)

    await svc.create_user(
        TENANT_ID,
        RRHH_ID,
        CreateUserRequest(
            email="nuevo@example.com",
            first_name="Carlos",
            last_name="Gil",
            cuil="20123456789",
            role="rrhh",
            whatsapp_numero="+5491112345678",
        ),
    )

    col_repo.create.assert_not_called()


# ── get_user ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_user_raises_403_for_collaborator_viewing_other_user():
    from fastapi import HTTPException

    other_user_id = "00000000-0000-0000-0000-000000000002"
    user_repo = AsyncMock()
    user_repo.get_by_id_with_profile.return_value = _make_user(id=other_user_id)

    current = _make_user(id=USER_ID)
    svc = _make_svc(user_repo)

    with pytest.raises(HTTPException) as exc:
        await svc.get_user(other_user_id, current)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_get_user_raises_404_on_wrong_tenant():
    from fastapi import HTTPException

    user_repo = AsyncMock()
    user_repo.get_by_id_with_profile.return_value = _make_user(tenant_id="00000000-0000-0000-0000-000000000099")

    current = _make_user(role="rrhh")
    svc = _make_svc(user_repo)

    with pytest.raises(HTTPException) as exc:
        await svc.get_user(USER_ID, current)
    assert exc.value.status_code == 404


# ── suspend_user ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_suspend_user_revokes_tokens():
    user_repo = AsyncMock()
    user_repo.get_by_id.return_value = _make_user(estado="activo")
    token_repo = AsyncMock()
    svc = _make_svc(user_repo, token_repo)

    await svc.suspend_user(USER_ID, TENANT_ID)

    user_repo.suspend.assert_called_once_with(USER_ID)
    token_repo.revoke_all_user_tokens.assert_called_once_with(USER_ID)


@pytest.mark.asyncio
async def test_suspend_user_raises_409_if_not_active():
    from fastapi import HTTPException

    user_repo = AsyncMock()
    user_repo.get_by_id.return_value = _make_user(estado="suspendido")
    svc = _make_svc(user_repo)

    with pytest.raises(HTTPException) as exc:
        await svc.suspend_user(USER_ID, TENANT_ID)
    assert exc.value.status_code == 409


# ── baja_user ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_baja_user_revokes_tokens():
    user_repo = AsyncMock()
    user_repo.get_by_id.return_value = _make_user(estado="activo")
    token_repo = AsyncMock()
    svc = _make_svc(user_repo, token_repo)

    await svc.baja_user(USER_ID, TENANT_ID, BajaRequest())

    user_repo.baja.assert_called_once()
    token_repo.revoke_all_user_tokens.assert_called_once_with(USER_ID)


# ── reactivate_user ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reactivate_raises_409_if_not_suspended():
    from fastapi import HTTPException

    user_repo = AsyncMock()
    user_repo.get_by_id.return_value = _make_user(estado="activo")
    svc = _make_svc(user_repo)

    with pytest.raises(HTTPException) as exc:
        await svc.reactivate_user(USER_ID, TENANT_ID)
    assert exc.value.status_code == 409
