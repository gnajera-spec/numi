import smtplib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.smtp_service import SmtpService

TENANT_ID = "00000000-0000-0000-0000-000000000010"
ENC_KEY   = "0" * 64  # 64 hex chars = 32 bytes AES key


def _make_cfg(**kwargs) -> dict:
    return {
        "id": "cccccccc-0000-0000-0000-000000000001",
        "tenant_id": TENANT_ID,
        "host": "smtp.empresa.com",
        "port": 587,
        "username": "no-reply@empresa.com",
        "password_enc": "dummy-encrypted",
        "from_email": "no-reply@empresa.com",
        "from_name": "Empresa SA",
        "use_tls": True,
        "activo": True,
        "use_numi_smtp": False,
        **kwargs,
    }


def _make_service(cfg=None) -> tuple[SmtpService, AsyncMock]:
    repo = AsyncMock()
    repo.get_by_tenant.return_value = cfg
    svc = SmtpService(repo, ENC_KEY)
    return svc, repo


# ── get_config ────────────────────────────────────────────────────────────────

class TestGetConfig:
    @pytest.mark.asyncio
    async def test_returns_config_when_activo(self):
        svc, _ = _make_service(cfg=_make_cfg())
        result = await svc.get_config(TENANT_ID)
        assert result is not None
        assert result["host"] == "smtp.empresa.com"

    @pytest.mark.asyncio
    async def test_returns_none_when_activo_false(self):
        svc, _ = _make_service(cfg=_make_cfg(activo=False))
        result = await svc.get_config(TENANT_ID)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_no_config(self):
        svc, _ = _make_service(cfg=None)
        result = await svc.get_config(TENANT_ID)
        assert result is None


# ── send_invitation ───────────────────────────────────────────────────────────

class TestSendInvitation:
    @pytest.mark.asyncio
    async def test_returns_false_when_no_smtp(self):
        svc, _ = _make_service(cfg=None)
        result = await svc.send_invitation(TENANT_ID, "a@e.com", "http://x/onboarding/tok", "Empresa")
        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_when_smtp_inactive(self):
        svc, _ = _make_service(cfg=_make_cfg(activo=False))
        result = await svc.send_invitation(TENANT_ID, "a@e.com", "http://x/onboarding/tok", "Empresa")
        assert result is False

    @pytest.mark.asyncio
    async def test_calls_send_when_smtp_active(self):
        svc, _ = _make_service(cfg=_make_cfg())
        with patch.object(svc, "_send", new=AsyncMock(return_value=True)) as mock_send:
            result = await svc.send_invitation(TENANT_ID, "a@e.com", "http://x/tok", "Empresa SA")
        assert result is True
        mock_send.assert_called_once()
        _, to_email, subject, html = mock_send.call_args.args
        assert to_email == "a@e.com"
        assert "Empresa SA" in subject
        assert "http://x/tok" in html


# ── test_connection ───────────────────────────────────────────────────────────

class TestTestConnection:
    @pytest.mark.asyncio
    async def test_tls_success(self):
        svc, _ = _make_service()
        cfg = {"host": "smtp.test.com", "port": 587, "username": "u", "use_tls": True}

        mock_smtp = MagicMock()
        mock_smtp.__enter__ = MagicMock(return_value=mock_smtp)
        mock_smtp.__exit__ = MagicMock(return_value=False)

        with patch("smtplib.SMTP", return_value=mock_smtp):
            ok, msg = await svc.test_connection(cfg, "password123")
        assert ok is True
        assert "exitosa" in msg.lower()

    @pytest.mark.asyncio
    async def test_auth_error_returns_false(self):
        svc, _ = _make_service()
        cfg = {"host": "smtp.test.com", "port": 587, "username": "u", "use_tls": True}

        mock_smtp = MagicMock()
        mock_smtp.__enter__ = MagicMock(return_value=mock_smtp)
        mock_smtp.__exit__ = MagicMock(return_value=False)
        mock_smtp.starttls = MagicMock()
        mock_smtp.login = MagicMock(side_effect=smtplib.SMTPAuthenticationError(535, b"Auth failed"))

        with patch("smtplib.SMTP", return_value=mock_smtp):
            ok, msg = await svc.test_connection(cfg, "wrong-password")
        assert ok is False
        assert "autenticación" in msg.lower()

    @pytest.mark.asyncio
    async def test_connect_error_returns_false(self):
        svc, _ = _make_service()
        cfg = {"host": "smtp.test.com", "port": 587, "username": "u", "use_tls": True}

        with patch("smtplib.SMTP", side_effect=smtplib.SMTPConnectError(421, b"Service unavailable")):
            ok, msg = await svc.test_connection(cfg, "password")
        assert ok is False
        assert "conectar" in msg.lower()

    @pytest.mark.asyncio
    async def test_ssl_mode_uses_smtp_ssl(self):
        svc, _ = _make_service()
        cfg = {"host": "smtp.test.com", "port": 465, "username": "u", "use_tls": False}

        mock_smtp = MagicMock()
        mock_smtp.__enter__ = MagicMock(return_value=mock_smtp)
        mock_smtp.__exit__ = MagicMock(return_value=False)

        with patch("smtplib.SMTP_SSL", return_value=mock_smtp) as mock_ssl:
            ok, msg = await svc.test_connection(cfg, "pass")
        mock_ssl.assert_called_once()
        assert ok is True

    @pytest.mark.asyncio
    async def test_generic_exception_returns_error_message(self):
        svc, _ = _make_service()
        cfg = {"host": "smtp.test.com", "port": 587, "username": "u", "use_tls": True}

        with patch("smtplib.SMTP", side_effect=ConnectionRefusedError("refused")):
            ok, msg = await svc.test_connection(cfg, "pass")
        assert ok is False
        assert "Error" in msg
