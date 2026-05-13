from supabase._async.client import AsyncClient


class DepartamentoRepository:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    async def list(
        self,
        tenant_id: str,
        is_active: bool | None = None,
    ) -> list[dict]:
        q = self._db.table("departamentos").select("*").eq("tenant_id", tenant_id)
        if is_active is not None:
            q = q.eq("is_active", is_active)
        resp = await q.order("nombre").execute()
        return resp.data or []

    async def get(self, depto_id: str, tenant_id: str) -> dict | None:
        resp = await self._db.table("departamentos").select("*").eq("id", depto_id).eq(
            "tenant_id", tenant_id
        ).single().execute()
        return resp.data

    async def get_by_nombre(
        self, tenant_id: str, nombre: str, padre_id: str | None
    ) -> dict | None:
        q = self._db.table("departamentos").select("id").eq("tenant_id", tenant_id).eq(
            "nombre", nombre
        )
        if padre_id:
            q = q.eq("padre_id", padre_id)
        else:
            q = q.is_("padre_id", "null")
        resp = await q.execute()
        return resp.data[0] if resp.data else None

    async def count_niveles(self, depto_id: str, tenant_id: str) -> int:
        """Cuenta el nivel del departamento (1 = raíz). Para validar máx. 3 niveles."""
        nivel = 1
        current_id = depto_id
        for _ in range(3):
            resp = await self._db.table("departamentos").select("padre_id").eq(
                "id", current_id
            ).eq("tenant_id", tenant_id).single().execute()
            if not resp.data or resp.data["padre_id"] is None:
                break
            current_id = resp.data["padre_id"]
            nivel += 1
        return nivel

    async def create(self, data: dict) -> dict:
        resp = await self._db.table("departamentos").insert(data).execute()
        return resp.data[0]

    async def update(self, depto_id: str, tenant_id: str, data: dict) -> dict | None:
        resp = await self._db.table("departamentos").update(data).eq("id", depto_id).eq(
            "tenant_id", tenant_id
        ).execute()
        return resp.data[0] if resp.data else None
