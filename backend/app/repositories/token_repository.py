from datetime import datetime, timezone
from uuid import UUID

from supabase._async.client import AsyncClient


class TokenRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    # ── Refresh tokens ──────────────────────────────────────────

    async def create_refresh_token(
        self, user_id: str | UUID, token_hash: str, expires_at: datetime
    ) -> None:
        await self._db.table("refresh_tokens").insert(
            {
                "user_id": str(user_id),
                "token_hash": token_hash,
                "expires_at": expires_at.isoformat(),
            }
        ).execute()

    async def get_refresh_token(self, token_hash: str) -> dict | None:
        res = (
            await self._db.table("refresh_tokens")
            .select("*")
            .eq("token_hash", token_hash)
            .single()
            .execute()
        )
        return res.data

    async def revoke_refresh_token(self, token_hash: str) -> None:
        await self._db.table("refresh_tokens").update(
            {"revoked_at": datetime.now(timezone.utc).isoformat()}
        ).eq("token_hash", token_hash).execute()

    # ── Invite tokens ────────────────────────────────────────────

    async def get_invite_token(self, token_hash: str) -> dict | None:
        res = (
            await self._db.table("invite_tokens")
            .select("*")
            .eq("token_hash", token_hash)
            .single()
            .execute()
        )
        return res.data

    async def use_invite_token(self, token_hash: str) -> None:
        await self._db.table("invite_tokens").update(
            {"used_at": datetime.now(timezone.utc).isoformat()}
        ).eq("token_hash", token_hash).execute()
