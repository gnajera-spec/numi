from supabase._async.client import AsyncClient


class AccidenteTrabajoRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def create(self, data: dict) -> dict:
        res = await (
            self._db.table("accidentes_trabajo")
            .insert(data)
            .select("*")
            .execute()
        )
        return res.data[0]

    async def get(self, accidente_id: str, tenant_id: str) -> dict | None:
        res = await (
            self._db.table("accidentes_trabajo")
            .select("*")
            .eq("id", accidente_id)
            .eq("tenant_id", tenant_id)
            .maybe_single()
            .execute()
        )
        return res.data

    async def list_by_tenant(
        self,
        tenant_id: str,
        estado: str | None,
        user_id: str | None,
        desde: str | None,
        hasta: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[dict], int]:
        q = (
            self._db.table("accidentes_trabajo")
            .select("*", count="exact")
            .eq("tenant_id", tenant_id)
            .order("fecha_hora", desc=True)
            .range(offset, offset + limit - 1)
        )
        if estado:
            q = q.eq("estado", estado)
        if user_id:
            q = q.eq("user_id", user_id)
        if desde:
            q = q.gte("fecha_hora", desde)
        if hasta:
            q = q.lte("fecha_hora", hasta)
        res = await q.execute()
        return res.data or [], res.count or 0

    async def update(self, accidente_id: str, tenant_id: str, payload: dict) -> dict:
        res = await (
            self._db.table("accidentes_trabajo")
            .update(payload)
            .eq("id", accidente_id)
            .eq("tenant_id", tenant_id)
            .select("*")
            .single()
            .execute()
        )
        return res.data
