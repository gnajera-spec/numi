from supabase._async.client import AsyncClient


class ConvenioRepository:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    async def list(self, tenant_id: str) -> list[dict]:
        resp = await self._db.table("convenios").select("*").eq(
            "tenant_id", tenant_id
        ).eq("is_active", True).order("nombre").execute()
        return resp.data or []

    async def get_by_nombre(self, tenant_id: str, nombre: str) -> dict | None:
        resp = await self._db.table("convenios").select("id").eq("tenant_id", tenant_id).eq(
            "nombre", nombre
        ).execute()
        return resp.data[0] if resp.data else None

    async def create(self, data: dict) -> dict:
        resp = await self._db.table("convenios").insert(data).execute()
        return resp.data[0]
