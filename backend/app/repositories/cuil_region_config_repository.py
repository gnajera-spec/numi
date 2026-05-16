from supabase._async.client import AsyncClient

_TABLE = "cuil_region_config"


class CuilRegionConfigRepository:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    async def get(self, tenant_id: str) -> dict | None:
        res = await self._db.table(_TABLE).select("*").eq("tenant_id", tenant_id).limit(1).execute()
        return res.data[0] if res.data else None

    async def upsert(self, tenant_id: str, data: dict) -> dict:
        payload = {"tenant_id": tenant_id, **data}
        res = await (
            self._db.table(_TABLE)
            .upsert(payload, on_conflict="tenant_id")
            .execute()
        )
        return res.data[0]
