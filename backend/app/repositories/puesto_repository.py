from supabase._async.client import AsyncClient


class PuestoRepository:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    async def list(
        self,
        tenant_id: str,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[dict], int]:
        q = self._db.table("puestos").select("*", count="exact").eq("tenant_id", tenant_id)
        offset = (page - 1) * page_size
        q = q.order("nombre").range(offset, offset + page_size - 1)
        resp = await q.execute()
        return resp.data or [], resp.count or 0

    async def get(self, puesto_id: str, tenant_id: str) -> dict | None:
        resp = await self._db.table("puestos").select("*").eq("id", puesto_id).eq(
            "tenant_id", tenant_id
        ).single().execute()
        return resp.data

    async def get_by_nombre(self, tenant_id: str, nombre: str) -> dict | None:
        resp = await self._db.table("puestos").select("id").eq("tenant_id", tenant_id).eq(
            "nombre", nombre
        ).execute()
        return resp.data[0] if resp.data else None

    async def create(self, data: dict) -> dict:
        resp = await self._db.table("puestos").insert(data).execute()
        return resp.data[0]

    async def update(self, puesto_id: str, tenant_id: str, data: dict) -> dict | None:
        resp = await self._db.table("puestos").update(data).eq("id", puesto_id).eq(
            "tenant_id", tenant_id
        ).execute()
        return resp.data[0] if resp.data else None
