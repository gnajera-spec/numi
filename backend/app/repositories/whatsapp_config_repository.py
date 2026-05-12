from supabase._async.client import AsyncClient

_TABLE = "whatsapp_config"


class WhatsappConfigRepository:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    async def get_by_tenant(self, tenant_id: str) -> dict | None:
        r = await self._db.table(_TABLE).select("*").eq("tenant_id", tenant_id).maybe_single().execute()
        return r.data

    async def get_by_phone_number_id(self, phone_number_id: str) -> dict | None:
        r = await self._db.table(_TABLE).select("*").eq("phone_number_id", phone_number_id).maybe_single().execute()
        return r.data

    async def upsert(self, tenant_id: str, data: dict) -> dict:
        payload = {"tenant_id": tenant_id, **data}
        r = (
            await self._db.table(_TABLE)
            .upsert(payload, on_conflict="tenant_id")
            .execute()
        )
        return r.data[0]

    async def set_active(self, tenant_id: str, *, active: bool) -> None:
        await (
            self._db.table(_TABLE)
            .update({"is_active": active})
            .eq("tenant_id", tenant_id)
            .execute()
        )
