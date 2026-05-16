from datetime import datetime, timezone
from uuid import UUID

from supabase._async.client import AsyncClient


class UserRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    # ── Lookups ──────────────────────────────────────────────────

    async def get_by_email(self, email: str) -> dict | None:
        res = await self._db.table("users").select("*").eq("email", email).execute()
        return res.data[0] if res.data else None

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

    async def get_by_wa_id(self, wa_id: str, tenant_id: str) -> dict | None:
        import hashlib
        wa_hash = hashlib.sha256(wa_id.encode()).hexdigest()
        res = (
            await self._db.table("users")
            .select("*")
            .eq("whatsapp_id_hash", wa_hash)
            .eq("tenant_id", tenant_id)
            .maybe_single()
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

    # ── List ─────────────────────────────────────────────────────

    async def list_users(
        self,
        tenant_id: str,
        *,
        role: str | None = None,
        estado: str | None = None,
        sede_id: str | None = None,
        departamento_id: str | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        query = (
            self._db.table("users")
            .select("*", count="exact")
            .eq("tenant_id", tenant_id)
        )

        if role:
            query = query.eq("role", role)
        if estado:
            query = query.eq("estado", estado)
        if search:
            term = f"%{search}%"
            query = query.or_(
                f"first_name.ilike.{term},last_name.ilike.{term},email.ilike.{term},cuil.ilike.{term}"
            )

        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1).order("created_at", desc=True)

        res = await query.execute()
        return res.data or [], res.count or 0

    # ── Create ───────────────────────────────────────────────────

    async def create(
        self,
        tenant_id: str | UUID,
        data: dict,
        created_by: str | UUID | None = None,
    ) -> dict:
        payload = {
            "tenant_id": str(tenant_id),
            "email": data["email"],
            "first_name": data["first_name"],
            "last_name": data["last_name"],
            "cuil": data["cuil"],
            "role": data["role"],
            "estado": "pendiente",
        }
        if data.get("whatsapp_numero_masked"):
            payload["whatsapp_numero_masked"] = data["whatsapp_numero_masked"]
        if data.get("whatsapp_id_hash"):
            payload["whatsapp_id_hash"] = data["whatsapp_id_hash"]
        if data.get("whatsapp_id_encrypted"):
            payload["whatsapp_id_encrypted"] = data["whatsapp_id_encrypted"]
        if created_by:
            payload["created_by"] = str(created_by)

        res = await self._db.table("users").insert(payload).select("*").execute()
        return res.data[0]

    async def create_with_password(self, data: dict) -> dict:
        """Crea usuario con password_hash ya hasheado — uso exclusivo de super_admin al provisionar tenants."""
        payload = {
            "tenant_id": data["tenant_id"],
            "email": data["email"],
            "first_name": data["first_name"],
            "last_name": data["last_name"],
            "role": data["role"],
            "estado": data.get("estado", "activo"),
            "password_hash": data["password_hash"],
        }
        if data.get("cuil"):
            payload["cuil"] = data["cuil"]
        res = await self._db.table("users").insert(payload).select("*").execute()
        return res.data[0]

    # ── Update ───────────────────────────────────────────────────

    async def update(self, user_id: str | UUID, data: dict) -> dict | None:
        payload: dict = {}
        for field in ("first_name", "last_name"):
            if field in data and data[field] is not None:
                payload[field] = data[field]

        if not payload:
            return await self.get_by_id(user_id)

        res = (
            await self._db.table("users")
            .update(payload)
            .eq("id", str(user_id))
            .select("*")
            .single()
            .execute()
        )
        return res.data


    async def set_role(self, user_id: str | UUID, role: str, tenant_id: str) -> dict | None:
        """Actualiza el rol de un usuario (verificando que pertenezca al tenant)."""
        res = await (
            self._db.table("users")
            .update({"role": role, "roles": [role]})
            .eq("id", str(user_id))
            .eq("tenant_id", tenant_id)
            .select("*")
            .execute()
        )
        return res.data[0] if res.data else None

    async def set_roles(self, user_id: str | UUID, roles: list[str], tenant_id: str) -> dict | None:
        """Asigna múltiples roles. El rol primario se deriva por prioridad."""
        _priority = ["super_admin", "admin_empresa", "rrhh", "servicio_medico", "colaborador"]
        primary = next((r for r in _priority if r in roles), roles[0] if roles else "colaborador")
        res = await (
            self._db.table("users")
            .update({"role": primary, "roles": roles})
            .eq("id", str(user_id))
            .eq("tenant_id", tenant_id)
            .select("*")
            .execute()
        )
        return res.data[0] if res.data else None

    async def list_users_by_tenant(self, tenant_id: str) -> list[dict]:
        """Devuelve todos los usuarios de un tenant — uso exclusivo super_admin."""
        res = await (
            self._db.table("users")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("last_name")
            .execute()
        )
        return res.data or []
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

    # ── Lifecycle ─────────────────────────────────────────────────

    async def suspend(self, user_id: str | UUID) -> dict | None:
        res = (
            await self._db.table("users")
            .update({
                "estado": "suspendido",
                "suspended_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", str(user_id))
            .select("*")
            .single()
            .execute()
        )
        return res.data

    async def reactivate(self, user_id: str | UUID) -> dict | None:
        res = (
            await self._db.table("users")
            .update({"estado": "activo", "suspended_at": None})
            .eq("id", str(user_id))
            .select("*")
            .single()
            .execute()
        )
        return res.data

    async def baja(self, user_id: str | UUID, baja_at: datetime | None = None) -> None:
        ts = (baja_at or datetime.now(timezone.utc)).isoformat()
        await self._db.table("users").update(
            {"estado": "baja", "baja_at": ts}
        ).eq("id", str(user_id)).execute()
