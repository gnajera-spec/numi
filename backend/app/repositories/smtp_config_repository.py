from supabase._async.client import AsyncClient


class SmtpConfigRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def get_by_tenant(self, tenant_id: str) -> dict | None:
        res = (
            await self._db.table("smtp_config")
            .select("*")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    async def upsert(self, tenant_id: str, data: dict) -> dict:
        from datetime import datetime, timezone
        data["tenant_id"] = tenant_id
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        res = (
            await self._db.table("smtp_config")
            .upsert(data, on_conflict="tenant_id")
            .execute()
        )
        return res.data[0]
