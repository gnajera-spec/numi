from datetime import datetime, timedelta, timezone

from supabase._async.client import AsyncClient

_TABLE = "whatsapp_sessions"
_TTL_MINUTES = 10


def _expiry() -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=_TTL_MINUTES)).isoformat()


class WhatsappSessionRepository:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    async def get(self, tenant_id: str, user_id: str) -> dict | None:
        r = (
            await self._db.table(_TABLE)
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return r.data

    async def upsert(self, tenant_id: str, user_id: str, estado_bot: str, contexto: dict) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        payload = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "estado_bot": estado_bot,
            "contexto": contexto,
            "ultimo_mensaje_at": now,
            "expira_at": _expiry(),
        }
        r = (
            await self._db.table(_TABLE)
            .upsert(payload, on_conflict="tenant_id,user_id")
            .execute()
        )
        return r.data[0]

    async def increment_count(self, tenant_id: str, user_id: str) -> None:
        # Supabase JS has rpc for increment; via raw SQL through rpc or re-read+update
        session = await self.get(tenant_id, user_id)
        if session:
            count = session.get("mensajes_count", 0) + 1
            await (
                self._db.table(_TABLE)
                .update({"mensajes_count": count, "expira_at": _expiry()})
                .eq("tenant_id", tenant_id)
                .eq("user_id", user_id)
                .execute()
            )

    async def reset(self, tenant_id: str, user_id: str) -> dict:
        """Reset session to idle state."""
        return await self.upsert(tenant_id, user_id, "idle", {})

    async def is_expired(self, session: dict) -> bool:
        expira = session.get("expira_at")
        if not expira:
            return True
        expira_dt = datetime.fromisoformat(expira.replace("Z", "+00:00"))
        return datetime.now(timezone.utc) > expira_dt
