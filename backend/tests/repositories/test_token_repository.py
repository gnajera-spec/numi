from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.repositories.token_repository import TokenRepository


def _make_db():
    db = MagicMock()
    db.table.return_value = db
    db.insert.return_value = db
    db.select.return_value = db
    db.update.return_value = db
    db.eq.return_value = db
    db.single.return_value = db
    db.execute = AsyncMock(return_value=MagicMock(data=None))
    return db


@pytest.mark.asyncio
async def test_create_refresh_token_calls_insert():
    db = _make_db()
    repo = TokenRepository(db)
    expires = datetime.now(timezone.utc) + timedelta(days=30)

    await repo.create_refresh_token("uid", "hash123", expires)

    db.table.assert_called_with("refresh_tokens")
    db.insert.assert_called_once()


@pytest.mark.asyncio
async def test_get_refresh_token_returns_data():
    db = _make_db()
    db.execute = AsyncMock(return_value=MagicMock(data={"token_hash": "h", "revoked_at": None}))
    repo = TokenRepository(db)

    result = await repo.get_refresh_token("h")

    assert result == {"token_hash": "h", "revoked_at": None}


@pytest.mark.asyncio
async def test_revoke_refresh_token_calls_update():
    db = _make_db()
    repo = TokenRepository(db)

    await repo.revoke_refresh_token("hash123")

    db.table.assert_called_with("refresh_tokens")
    db.update.assert_called_once()
