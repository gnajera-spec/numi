from supabase._async.client import AsyncClient


class VacunacionRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def create(self, data: dict) -> dict:
        res = await (
            self._db.table("vacunaciones")
            .insert(data)
            .select("*")
            .single()
            .execute()
        )
        return res.data

    async def list_by_user(self, user_id: str, tenant_id: str) -> list[dict]:
        res = await (
            self._db.table("vacunaciones")
            .select("*")
            .eq("user_id", user_id)
            .eq("tenant_id", tenant_id)
            .order("fecha", desc=True)
            .execute()
        )
        return res.data or []
