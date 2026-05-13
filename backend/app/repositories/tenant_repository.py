import math

from supabase._async.client import AsyncClient


class TenantRepository:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    async def list(
        self,
        estado: str | None = None,
        plan: str | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        q = self._db.table("tenants").select("*", count="exact")
        if estado:
            q = q.eq("estado", estado)
        if plan:
            q = q.eq("plan", plan)
        if search:
            q = q.ilike("nombre", f"%{search}%")
        offset = (page - 1) * page_size
        q = q.order("created_at", desc=True).range(offset, offset + page_size - 1)
        resp = await q.execute()
        return resp.data or [], resp.count or 0

    async def get(self, tenant_id: str) -> dict | None:
        resp = await self._db.table("tenants").select("*").eq("id", tenant_id).single().execute()
        return resp.data

    async def get_by_cuit(self, cuit: str) -> dict | None:
        resp = await self._db.table("tenants").select("id").eq("cuit", cuit).execute()
        return resp.data[0] if resp.data else None

    async def get_by_subdominio(self, subdominio: str) -> dict | None:
        resp = await self._db.table("tenants").select("id").eq("subdominio", subdominio).execute()
        return resp.data[0] if resp.data else None

    async def create(self, data: dict) -> dict:
        resp = await self._db.table("tenants").insert(data).execute()
        return resp.data[0]

    async def update(self, tenant_id: str, data: dict) -> dict | None:
        resp = await self._db.table("tenants").update(data).eq("id", tenant_id).execute()
        return resp.data[0] if resp.data else None
