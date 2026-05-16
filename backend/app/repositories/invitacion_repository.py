from uuid import UUID
from supabase._async.client import AsyncClient


class InvitacionRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def get_by_token(self, token: str) -> dict | None:
        res = (
            await self._db.table("invitaciones")
            .select("*, tenants(nombre)")
            .eq("token", token)
            .maybe_single()
            .execute()
        )
        return res.data

    async def get_by_cuil_and_tenant(self, cuil: str, tenant_id: str) -> dict | None:
        res = (
            await self._db.table("invitaciones")
            .select("*")
            .eq("cuil", cuil)
            .eq("tenant_id", tenant_id)
            .eq("estado", "pendiente")
            .maybe_single()
            .execute()
        )
        return res.data

    async def create(self, data: dict) -> dict:
        res = await self._db.table("invitaciones").insert(data).execute()
        return res.data[0]

    async def mark_completed(self, token: str) -> None:
        from datetime import datetime, timezone
        await (
            self._db.table("invitaciones")
            .update({"estado": "completada", "completed_at": datetime.now(timezone.utc).isoformat()})
            .eq("token", token)
            .execute()
        )

    async def list_by_tenant(self, tenant_id: str) -> list[dict]:
        res = (
            await self._db.table("invitaciones")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
