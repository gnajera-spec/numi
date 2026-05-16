from supabase._async.client import AsyncClient


class FlujoAprobacionRepository:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    async def list_tipos_licencia(self, tenant_id: str) -> list[dict]:
        response = (
            await self._db.table("tipos_licencia")
            .select("id, nombre, codigo")
            .eq("tenant_id", tenant_id)
            .eq("activo", True)
            .order("nombre")
            .execute()
        )
        return response.data or []

    async def list_active_flujos(self, tenant_id: str) -> list[dict]:
        """Returns all flujos (active or not) for the tenant, with step counts."""
        response = (
            await self._db.table("flujos_aprobacion")
            .select("id, tipo_licencia_id, nombre, is_active, pasos_flujo(count)")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        rows = response.data or []
        for row in rows:
            pasos = row.pop("pasos_flujo", [])
            row["pasos_count"] = pasos[0]["count"] if pasos else 0
        return rows

    async def get_by_id(self, flujo_id: str, tenant_id: str) -> dict | None:
        response = (
            await self._db.table("flujos_aprobacion")
            .select("*")
            .eq("id", flujo_id)
            .eq("tenant_id", tenant_id)
            .maybe_single()
            .execute()
        )
        return response.data

    async def get_active_for_tipo(self, tenant_id: str, tipo_licencia_id: str) -> dict | None:
        response = (
            await self._db.table("flujos_aprobacion")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("tipo_licencia_id", tipo_licencia_id)
            .eq("is_active", True)
            .maybe_single()
            .execute()
        )
        return response.data

    async def create(self, data: dict) -> dict:
        response = (
            await self._db.table("flujos_aprobacion")
            .insert(data)
            .select()
            .single()
            .execute()
        )
        return response.data

    async def update(self, flujo_id: str, tenant_id: str, data: dict) -> dict | None:
        response = (
            await self._db.table("flujos_aprobacion")
            .update(data)
            .eq("id", flujo_id)
            .eq("tenant_id", tenant_id)
            .select()
            .maybe_single()
            .execute()
        )
        return response.data

    async def deactivate(self, flujo_id: str, tenant_id: str) -> dict | None:
        return await self.update(flujo_id, tenant_id, {"is_active": False})

    async def count_active_solicitudes(self, flujo_id: str) -> int:
        """Count solicitudes using this flow that are still in progress."""
        response = (
            await self._db.table("solicitudes_licencia")
            .select("id", count="exact")
            .eq("flujo_id", flujo_id)
            .in_("estado", ["pendiente", "en_revision"])
            .execute()
        )
        return response.count or 0

    async def get_pasos(self, flujo_id: str) -> list[dict]:
        response = (
            await self._db.table("pasos_flujo")
            .select("*, departamentos(nombre)")
            .eq("flujo_id", flujo_id)
            .order("orden")
            .execute()
        )
        rows = response.data or []
        # flatten departamento nombre
        for row in rows:
            dept = row.pop("departamentos", None)
            row["departamento_nombre"] = dept["nombre"] if dept else None
        return rows

    async def create_paso(self, data: dict) -> dict:
        response = (
            await self._db.table("pasos_flujo")
            .insert(data)
            .select()
            .single()
            .execute()
        )
        return response.data

    async def delete_pasos(self, flujo_id: str) -> None:
        await self._db.table("pasos_flujo").delete().eq("flujo_id", flujo_id).execute()

    async def get_departamentos_activos(self, tenant_id: str) -> list[dict]:
        response = (
            await self._db.table("departamentos")
            .select("id, nombre")
            .eq("tenant_id", tenant_id)
            .eq("activo", True)
            .order("nombre")
            .execute()
        )
        return response.data or []
