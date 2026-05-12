from uuid import UUID

from supabase._async.client import AsyncClient


_SELECT_FULL = "*, tipos_licencia(id, codigo, nombre)"


class SaldoLicenciaRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def get(self, tenant_id: str, user_id: str, tipo_licencia_id: str, anio: int) -> dict | None:
        res = await (
            self._db.table("saldo_licencias")
            .select(_SELECT_FULL)
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .eq("tipo_licencia_id", tipo_licencia_id)
            .eq("anio", anio)
            .maybe_single()
            .execute()
        )
        return res.data

    async def list_for_user(self, tenant_id: str, user_id: str | UUID, anio: int) -> list[dict]:
        res = await (
            self._db.table("saldo_licencias")
            .select(_SELECT_FULL)
            .eq("tenant_id", tenant_id)
            .eq("user_id", str(user_id))
            .eq("anio", anio)
            .execute()
        )
        return res.data or []

    async def ensure_saldo(
        self,
        tenant_id: str,
        user_id: str,
        tipo_licencia_id: str,
        anio: int,
        dias_disponibles: int = 0,
    ) -> dict:
        """Get or create a saldo record."""
        existing = await self.get(tenant_id, user_id, tipo_licencia_id, anio)
        if existing:
            return existing

        res = await (
            self._db.table("saldo_licencias")
            .insert({
                "tenant_id": tenant_id,
                "user_id": user_id,
                "tipo_licencia_id": tipo_licencia_id,
                "anio": anio,
                "dias_disponibles": dias_disponibles,
            })
            .select(_SELECT_FULL)
            .single()
            .execute()
        )
        return res.data

    async def add_pendientes(self, tenant_id: str, user_id: str, tipo_licencia_id: str, anio: int, dias: int) -> None:
        """Increment dias_pendientes when a solicitud is created."""
        saldo = await self.ensure_saldo(tenant_id, user_id, tipo_licencia_id, anio)
        new_val = saldo["dias_pendientes"] + dias
        await (
            self._db.table("saldo_licencias")
            .update({"dias_pendientes": new_val})
            .eq("id", saldo["id"])
            .execute()
        )

    async def subtract_pendientes(self, tenant_id: str, user_id: str, tipo_licencia_id: str, anio: int, dias: int) -> None:
        """Decrement dias_pendientes when a solicitud is canceled or rejected."""
        saldo = await self.get(tenant_id, user_id, tipo_licencia_id, anio)
        if not saldo:
            return
        new_val = max(0, saldo["dias_pendientes"] - dias)
        await (
            self._db.table("saldo_licencias")
            .update({"dias_pendientes": new_val})
            .eq("id", saldo["id"])
            .execute()
        )

    async def approve(self, tenant_id: str, user_id: str, tipo_licencia_id: str, anio: int, dias: int) -> None:
        """Move dias from pendientes to tomados on approval."""
        saldo = await self.get(tenant_id, user_id, tipo_licencia_id, anio)
        if not saldo:
            return
        new_pendientes = max(0, saldo["dias_pendientes"] - dias)
        new_tomados = saldo["dias_tomados"] + dias
        await (
            self._db.table("saldo_licencias")
            .update({"dias_pendientes": new_pendientes, "dias_tomados": new_tomados})
            .eq("id", saldo["id"])
            .execute()
        )
