from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pyotp

from app.services.mfa_service import MfaService

USER_ID = "00000000-0000-0000-0000-000000000001"
TENANT_ID = "00000000-0000-0000-0000-000000000002"
FAKE_ENCRYPTION_KEY = "a" * 64  # 32 bytes hex


def _make_service():
    mfa_repo = AsyncMock()
    user_repo = AsyncMock()
    token_repo = AsyncMock()
    svc = MfaService(mfa_repo, user_repo, token_repo)
    svc._settings = MagicMock(
        secret_key="test-secret-key-32-chars-minimum!",
        encryption_key=FAKE_ENCRYPTION_KEY,
    )
    return svc, mfa_repo, user_repo, token_repo


# ── setup ─────────────────────────────────────────────────────────────────────

def test_setup_returns_secret_qr_and_backup_codes():
    svc, _, _, _ = _make_service()
    result = svc.setup(USER_ID, "test@example.com")

    assert result.secret
    assert "otpauth://" in result.qr_uri
    assert "HRConnect" in result.qr_uri
    assert len(result.backup_codes) == 8
    for code in result.backup_codes:
        assert len(code) == 8  # 4 bytes hex = 8 chars


# ── enable ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_enable_saves_encrypted_secret_when_code_valid():
    svc, mfa_repo, _, _ = _make_service()
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    with patch("app.services.mfa_service.encrypt", return_value="encrypted"):
        await svc.enable(USER_ID, valid_code, secret)

    mfa_repo.enable_mfa.assert_awaited_once()
    call_kwargs = mfa_repo.enable_mfa.call_args
    assert call_kwargs.args[0] == USER_ID
    assert call_kwargs.args[1] == "encrypted"


@pytest.mark.asyncio
async def test_enable_raises_422_when_code_invalid():
    from fastapi import HTTPException
    svc, _, _, _ = _make_service()
    secret = pyotp.random_base32()

    with pytest.raises(HTTPException) as exc:
        await svc.enable(USER_ID, "000000", secret)
    assert exc.value.status_code == 422


# ── challenge ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_challenge_returns_tokens_with_valid_code():
    svc, mfa_repo, user_repo, token_repo = _make_service()

    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    mfa_token = svc._issue_mfa_token(USER_ID)

    mfa_repo.get_mfa_data.return_value = {
        "id": USER_ID,
        "mfa_enabled": True,
        "mfa_secret_encrypted": "encrypted_secret",
        "mfa_backup_codes_encrypted": None,
    }
    user_repo.get_by_id.return_value = {
        "id": USER_ID,
        "email": "test@example.com",
        "first_name": "Juan",
        "last_name": "Perez",
        "role": "rrhh",
        "estado": "activo",
        "tenant_id": TENANT_ID,
        "avatar_url": None,
        "mfa_enabled": True,
    }
    user_repo.update_last_login.return_value = None
    token_repo.create_refresh_token.return_value = None

    with patch("app.services.mfa_service.decrypt", return_value=secret):
        result = await svc.challenge(mfa_token, valid_code)

    assert result.access_token is not None
    assert result.refresh_token is not None
    assert result.mfa_required is False


@pytest.mark.asyncio
async def test_challenge_raises_401_with_invalid_code():
    from fastapi import HTTPException
    svc, mfa_repo, _, _ = _make_service()

    secret = pyotp.random_base32()
    mfa_token = svc._issue_mfa_token(USER_ID)

    mfa_repo.get_mfa_data.return_value = {
        "id": USER_ID,
        "mfa_enabled": True,
        "mfa_secret_encrypted": "encrypted_secret",
        "mfa_backup_codes_encrypted": None,
    }

    with patch("app.services.mfa_service.decrypt", return_value=secret):
        with pytest.raises(HTTPException) as exc:
            await svc.challenge(mfa_token, "000000")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_challenge_accepts_backup_code():
    svc, mfa_repo, user_repo, token_repo = _make_service()

    secret = pyotp.random_base32()
    backup_code = "AABB1122"
    mfa_token = svc._issue_mfa_token(USER_ID)

    mfa_repo.get_mfa_data.return_value = {
        "id": USER_ID,
        "mfa_enabled": True,
        "mfa_secret_encrypted": "encrypted_secret",
        "mfa_backup_codes_encrypted": "encrypted_codes",
    }
    user_repo.get_by_id.return_value = {
        "id": USER_ID,
        "email": "test@example.com",
        "first_name": "Juan",
        "last_name": "Perez",
        "role": "rrhh",
        "estado": "activo",
        "tenant_id": TENANT_ID,
        "avatar_url": None,
        "mfa_enabled": True,
    }
    user_repo.update_last_login.return_value = None
    token_repo.create_refresh_token.return_value = None

    def fake_decrypt(val, key):
        if val == "encrypted_secret":
            return secret
        return f"CODE1111,{backup_code},CODE3333"

    with patch("app.services.mfa_service.decrypt", side_effect=fake_decrypt):
        with patch("app.services.mfa_service.encrypt", return_value="new_encrypted"):
            result = await svc.challenge(mfa_token, backup_code)

    assert result.access_token is not None
    # Backup code consumed — enable_mfa called to update remaining codes
    mfa_repo.enable_mfa.assert_awaited_once()


# ── disable ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_disable_clears_mfa_when_code_valid():
    svc, mfa_repo, _, _ = _make_service()
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    mfa_repo.get_mfa_data.return_value = {
        "id": USER_ID,
        "mfa_enabled": True,
        "mfa_secret_encrypted": "encrypted_secret",
    }

    with patch("app.services.mfa_service.decrypt", return_value=secret):
        await svc.disable(USER_ID, valid_code)

    mfa_repo.disable_mfa.assert_awaited_once_with(USER_ID)


@pytest.mark.asyncio
async def test_disable_raises_422_when_code_invalid():
    from fastapi import HTTPException
    svc, mfa_repo, _, _ = _make_service()
    secret = pyotp.random_base32()

    mfa_repo.get_mfa_data.return_value = {
        "id": USER_ID,
        "mfa_enabled": True,
        "mfa_secret_encrypted": "encrypted_secret",
    }

    with patch("app.services.mfa_service.decrypt", return_value=secret):
        with pytest.raises(HTTPException) as exc:
            await svc.disable(USER_ID, "000000")
    assert exc.value.status_code == 422
