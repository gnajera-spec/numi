from supabase._async.client import AsyncClient


class FichaMedicaRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def get(self, user_id: str, tenant_id: str) -> dict | None:
        res = await (
            self._db.table("fichas_medicas")
            .select("*")
            .eq("user_id", user_id)
            .eq("tenant_id", tenant_id)
            .maybe_single()
            .execute()
        )
        return res.data

    async def upsert(self, user_id: str, tenant_id: str, payload: dict) -> dict:
        data = {"user_id": user_id, "tenant_id": tenant_id, **payload}
        res = await (
            self._db.table("fichas_medicas")
            .upsert(data, on_conflict="user_id")
            .select("*")
            .single()
            .execute()
        )
        return res.data

    async def list_with_users(
        self,
        tenant_id: str,
        sede_id: str | None,
        departamento_id: str | None,
        search: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[dict], int]:
        q = (
            self._db.table("users")
            .select(
                "id, nombre, apellido, email, colaborador_perfil!inner(sede_id, departamento_id), fichas_medicas(id, grupo_sanguineo)",
                count="exact",
            )
            .eq("tenant_id", tenant_id)
            .eq("role", "colaborador")
            .eq("estado", "activo")
            .order("apellido")
            .range(offset, offset + limit - 1)
        )
        if sede_id:
            q = q.eq("colaborador_perfil.sede_id", sede_id)
        if departamento_id:
            q = q.eq("colaborador_perfil.departamento_id", departamento_id)
        if search:
            q = q.ilike("apellido", f"%{search}%")
        res = await q.execute()
        return res.data or [], res.count or 0
