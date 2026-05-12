from supabase._async.client import AsyncClient


class AptitudLaboralRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def create(self, data: dict) -> dict:
        res = await (
            self._db.table("aptitudes_laborales")
            .insert(data)
            .select("*")
            .single()
            .execute()
        )
        return res.data

    async def list_by_user(self, user_id: str, tenant_id: str) -> list[dict]:
        res = await (
            self._db.table("aptitudes_laborales")
            .select("*")
            .eq("user_id", user_id)
            .eq("tenant_id", tenant_id)
            .order("fecha_emision", desc=True)
            .execute()
        )
        return res.data or []

    async def list_por_vencer(
        self,
        tenant_id: str,
        dias: int,
        sede_id: str | None,
        departamento_id: str | None,
    ) -> list[dict]:
        from datetime import date, timedelta
        hoy = date.today().isoformat()
        limite = (date.today() + timedelta(days=dias)).isoformat()
        q = (
            self._db.table("aptitudes_laborales")
            .select(
                "id, user_id, puesto_id, estado, fecha_vencimiento, "
                "users!user_id(nombre, apellido), puestos!puesto_id(nombre)"
            )
            .eq("tenant_id", tenant_id)
            .gte("fecha_vencimiento", hoy)
            .lte("fecha_vencimiento", limite)
            .order("fecha_vencimiento")
        )
        res = await q.execute()
        return res.data or []
