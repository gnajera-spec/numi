from supabase._async.client import AsyncClient


class SedeRepository:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    async def list(
        self,
        tenant_id: str,
        is_active: bool | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[dict], int]:
        q = self._db.table("sedes").select("*", count="exact").eq("tenant_id", tenant_id)
        if is_active is not None:
            q = q.eq("is_active", is_active)
        offset = (page - 1) * page_size
        q = q.order("nombre").range(offset, offset + page_size - 1)
        resp = await q.execute()
        return resp.data or [], resp.count or 0

    async def get(self, sede_id: str, tenant_id: str) -> dict | None:
        resp = await self._db.table("sedes").select("*").eq("id", sede_id).eq(
            "tenant_id", tenant_id
        ).single().execute()
        return resp.data

    async def get_by_nombre(self, tenant_id: str, nombre: str) -> dict | None:
        resp = await self._db.table("sedes").select("id").eq("tenant_id", tenant_id).eq(
            "nombre", nombre
        ).execute()
        return resp.data[0] if resp.data else None

    async def create(self, data: dict) -> dict:
        resp = await self._db.table("sedes").insert(data).execute()
        return resp.data[0]

    async def update(self, sede_id: str, tenant_id: str, data: dict) -> dict | None:
        resp = await self._db.table("sedes").update(data).eq("id", sede_id).eq(
            "tenant_id", tenant_id
        ).execute()
        return resp.data[0] if resp.data else None
