import hashlib
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.whatsapp_service import WhatsappService

TENANT_ID = "00000000-0000-0000-0000-000000000010"
USER_ID   = "00000000-0000-0000-0000-000000000011"
RECIBO_ID = "00000000-0000-0000-0000-000000000013"
WA_ID     = "5491112345678"
ENC_KEY   = "a" * 64  # 32 bytes hex (dev placeholder — not valid AES key in unit tests)


def _settings(**kwargs):
    s = MagicMock()
    s.meta_verify_token = kwargs.get("meta_verify_token", "verify-secret")
    s.meta_app_secret = kwargs.get("meta_app_secret", "")
    s.encryption_key = kwargs.get("encryption_key", ENC_KEY)
    return s


def _make_svc(**overrides) -> WhatsappService:
    return WhatsappService(
        db=overrides.get("db", AsyncMock()),
        settings=overrides.get("settings", _settings()),
        config_repo=overrides.get("config_repo", AsyncMock()),
        session_repo=overrides.get("session_repo", AsyncMock()),
        log_repo=overrides.get("log_repo", AsyncMock()),
        user_repo=overrides.get("user_repo", AsyncMock()),
        recibo_repo=overrides.get("recibo_repo", AsyncMock()),
    )


# ── verify_webhook ────────────────────────────────────────────────────────────

def test_verify_webhook_returns_challenge():
    svc = _make_svc(settings=_settings(meta_verify_token="my-token"))
    result = svc.verify_webhook("subscribe", "my-token", "abc123")
    assert result == "abc123"


def test_verify_webhook_wrong_token_raises_403():
    from fastapi import HTTPException
    svc = _make_svc(settings=_settings(meta_verify_token="correct"))
    with pytest.raises(HTTPException) as exc:
        svc.verify_webhook("subscribe", "wrong", "abc")
    assert exc.value.status_code == 403


def test_verify_webhook_wrong_mode_raises_400():
    from fastapi import HTTPException
    svc = _make_svc(settings=_settings(meta_verify_token="t"))
    with pytest.raises(HTTPException) as exc:
        svc.verify_webhook("unsubscribe", "t", "c")
    assert exc.value.status_code == 400


# ── validate_hmac ─────────────────────────────────────────────────────────────

def test_validate_hmac_skips_when_no_secret():
    svc = _make_svc(settings=_settings(meta_app_secret=""))
    # Should not raise even with wrong signature
    svc.validate_hmac(b"body", "sha256=wrong")


def test_validate_hmac_raises_403_on_invalid():
    import hmac as _hmac
    from fastapi import HTTPException

    secret = "real-secret"
    svc = _make_svc(settings=_settings(meta_app_secret=secret))
    with pytest.raises(HTTPException) as exc:
        svc.validate_hmac(b"body", "sha256=badsig")
    assert exc.value.status_code == 403


def test_validate_hmac_passes_on_valid():
    import hmac as _hmac
    import hashlib as _hl

    secret = "real-secret"
    body = b'{"object":"test"}'
    sig = "sha256=" + _hmac.new(secret.encode(), body, _hl.sha256).hexdigest()
    svc = _make_svc(settings=_settings(meta_app_secret=secret))
    svc.validate_hmac(body, sig)  # must not raise


# ── process_webhook — stale message ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_process_webhook_ignores_stale_message():
    svc = _make_svc()
    old_ts = int(datetime(2020, 1, 1, tzinfo=timezone.utc).timestamp())
    payload = {
        "entry": [{
            "changes": [{
                "field": "messages",
                "value": {
                    "metadata": {"phone_number_id": "123"},
                    "messages": [{
                        "id": "msg1",
                        "from": WA_ID,
                        "timestamp": str(old_ts),
                        "type": "text",
                        "text": {"body": "hola"},
                    }],
                    "contacts": [],
                },
            }]
        }]
    }
    svc._configs.get_by_phone_number_id = AsyncMock(return_value=None)
    await svc.process_webhook(payload)
    # No calls to session_repo since message is stale
    svc._sessions.get.assert_not_called()


# ── process_webhook — unknown phone_number_id ─────────────────────────────────

@pytest.mark.asyncio
async def test_process_webhook_ignores_unknown_phone_number_id():
    svc = _make_svc()
    now_ts = int(datetime.now(timezone.utc).timestamp())
    payload = {
        "entry": [{
            "changes": [{
                "field": "messages",
                "value": {
                    "metadata": {"phone_number_id": "unknown"},
                    "messages": [{
                        "id": "msg2",
                        "from": WA_ID,
                        "timestamp": str(now_ts),
                        "type": "text",
                        "text": {"body": "hola"},
                    }],
                    "contacts": [],
                },
            }]
        }]
    }
    svc._configs.get_by_phone_number_id = AsyncMock(return_value=None)
    await svc.process_webhook(payload)
    svc._sessions.get.assert_not_called()


# ── FSM: idle → menu_principal ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_handle_state_idle_any_message_shows_menu():
    session_repo = AsyncMock()
    log_repo = AsyncMock()

    svc = _make_svc(session_repo=session_repo, log_repo=log_repo)

    mock_client = AsyncMock()
    user = {"id": USER_ID, "first_name": "Juan", "last_name": "Perez"}

    from app.schemas.whatsapp import InboundMessage
    msg = InboundMessage(
        wa_message_id="m1",
        wa_id=WA_ID,
        phone_number_id="123",
        tipo="text",
        body="hola",
        timestamp=int(datetime.now(timezone.utc).timestamp()),
        raw={},
    )

    await svc._handle_state("idle", {}, msg, user, TENANT_ID, mock_client)

    session_repo.upsert.assert_called_once_with(TENANT_ID, USER_ID, "menu_principal", {})
    mock_client.send_text.assert_called_once()


# ── FSM: menu_principal → recibos ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_handle_state_menu_recibos_option_opens_flow():
    session_repo = AsyncMock()
    recibo_repo = AsyncMock()
    log_repo = AsyncMock()

    recibo_repo.get_latest_unsigned.return_value = {
        "id": RECIBO_ID,
        "storage_path": f"{TENANT_ID}/p1/20111234567.pdf",
        "archivo_hash": "abc123",
        "estado": "pendiente",
        "periodos_liquidacion": {"periodo": "2026-04", "descripcion": "Abril 2026"},
    }

    from unittest.mock import MagicMock
    bucket_mock = MagicMock()
    bucket_mock.create_signed_url = AsyncMock(return_value={"signedURL": "https://signed.url/recibo.pdf"})

    db = MagicMock()
    db.storage.from_.return_value = bucket_mock

    svc = _make_svc(session_repo=session_repo, recibo_repo=recibo_repo, log_repo=log_repo, db=db)

    mock_client = AsyncMock()
    user = {"id": USER_ID, "first_name": "Juan", "last_name": "Perez"}

    from app.schemas.whatsapp import InboundMessage
    msg = InboundMessage(
        wa_message_id="m2",
        wa_id=WA_ID,
        phone_number_id="123",
        tipo="text",
        body="1",
        timestamp=int(datetime.now(timezone.utc).timestamp()),
        raw={},
    )

    await svc._handle_state("menu_principal", {}, msg, user, TENANT_ID, mock_client)

    session_repo.upsert.assert_called_once_with(
        TENANT_ID, USER_ID, "recibos_confirmar", {"recibo_id": RECIBO_ID}
    )
    mock_client.send_document.assert_called_once()


# ── FSM: recibos_confirmar → firmar ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_handle_state_confirmar_registers_firma():
    session_repo = AsyncMock()
    recibo_repo = AsyncMock()
    log_repo = AsyncMock()

    recibo_repo.get_by_id_for_user.return_value = {
        "id": RECIBO_ID,
        "tenant_id": TENANT_ID,
        "user_id": USER_ID,
        "estado": "pendiente",
        "archivo_hash": "deadbeef",
        "periodos_liquidacion": {"periodo": "2026-04"},
    }

    svc = _make_svc(session_repo=session_repo, recibo_repo=recibo_repo, log_repo=log_repo)

    mock_client = AsyncMock()
    user = {"id": USER_ID, "first_name": "Juan", "last_name": "Perez"}

    from app.schemas.whatsapp import InboundMessage
    msg = InboundMessage(
        wa_message_id="m3",
        wa_id=WA_ID,
        phone_number_id="123",
        tipo="text",
        body="CONFIRMO",
        timestamp=int(datetime.now(timezone.utc).timestamp()),
        raw={},
    )

    await svc._handle_state("recibos_confirmar", {"recibo_id": RECIBO_ID}, msg, user, TENANT_ID, mock_client)

    recibo_repo.create_firma.assert_called_once()
    firma_call_args = recibo_repo.create_firma.call_args[0][0]
    assert firma_call_args["canal"] == "whatsapp"
    assert firma_call_args["recibo_id"] == RECIBO_ID

    recibo_repo.update_estado.assert_called_once_with(RECIBO_ID, "firmado")
    session_repo.reset.assert_called_once_with(TENANT_ID, USER_ID)


# ── FSM: already signed ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_confirm_firma_ignores_already_signed():
    recibo_repo = AsyncMock()
    session_repo = AsyncMock()
    log_repo = AsyncMock()

    recibo_repo.get_by_id_for_user.return_value = {
        "id": RECIBO_ID,
        "tenant_id": TENANT_ID,
        "user_id": USER_ID,
        "estado": "firmado",
        "archivo_hash": "deadbeef",
    }

    svc = _make_svc(session_repo=session_repo, recibo_repo=recibo_repo, log_repo=log_repo)
    mock_client = AsyncMock()

    await svc._confirm_firma(USER_ID, TENANT_ID, WA_ID, {"recibo_id": RECIBO_ID}, mock_client)

    recibo_repo.create_firma.assert_not_called()
    mock_client.send_text.assert_called_once()
    session_repo.reset.assert_called_once()


# ── encryption round-trip ─────────────────────────────────────────────────────

def test_encryption_round_trip():
    from app.utils.encryption import decrypt, encrypt
    key = "0" * 64  # 32 zero bytes
    plaintext = "EAAFake...access.token"
    ct = encrypt(plaintext, key)
    assert ct != plaintext
    assert decrypt(ct, key) == plaintext
