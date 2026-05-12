from supabase._async.client import AsyncClient


class ExamenMedicoRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def create(self, data: dict) -> dict:
        res = await (
            self._db.table("examenes_medicos")
            .insert(data)
            .select("*")
            .single()
            .execute()
        )
        return res.data

    async def list_by_user(self, user_id: str, tenant_id: str) -> list[dict]:
        res = await (
            self._db.table("examenes_medicos")
            .select("*")
            .eq("user_id", user_id)
            .eq("tenant_id", tenant_id)
            .order("fecha", desc=True)
            .execute()
        )
        return res.data or []

    async def update_storage_path(self, exam_id: str, storage_path: str) -> None:
        await (
            self._db.table("examenes_medicos")
            .update({"storage_path": storage_path})
            .eq("id", exam_id)
            .execute()
        )
