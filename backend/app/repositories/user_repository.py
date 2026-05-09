from datetime import datetime, timezone
from uuid import UUID

from supabase._async.client import AsyncClient


class UserRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def get_by_email(self, email: str) -> dict | None:
        res = await self._db.table("users").select("*").eq("email", email).single().execute()
        return res.data

    async def get_by_id(self, user_id: str | UUID) -> dict | None:
        res = (
            await self._db.table("users")
            .select("*")
            .eq("id", str(user_id))
            .single()
            .execute()
        )
        return res.data

    async def get_by_id_with_profile(self, user_id: str | UUID) -> dict | None:
        res = (
            await self._db.table("users")
            .select("*, colaborador_perfil(*)")
            .eq("id", str(user_id))
            .single()
            .execute()
        )
        return res.data

    async def update_last_login(self, user_id: str | UUID) -> None:
        await self._db.table("users").update(
            {"last_login_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", str(user_id)).execute()

    async def activate(
        self,
        user_id: str | UUID,
        password_hash: str,
        first_name: str | None = None,
        cuil: str | None = None,
    ) -> dict | None:
        payload: dict = {
            "password_hash": password_hash,
            "estado": "activo",
            "activated_at": datetime.now(timezone.utc).isoformat(),
        }
        if first_name is not None:
            payload["first_name"] = first_name
        if cuil is not None:
            payload["cuil"] = cuil
        res = (
            await self._db.table("users")
            .update(payload)
            .eq("id", str(user_id))
            .select("*")
            .single()
            .execute()
        )
        return res.data

    async def get_by_cuil_and_tenant(self, cuil: str, tenant_id: str) -> dict | None:
        res = (
            await self._db.table("users")
            .select("*")
            .eq("cuil", cuil)
            .eq("tenant_id", tenant_id)
            .single()
            .execute()
        )
        return res.data
