from uuid import UUID

from supabase._async.client import AsyncClient


class PoliticaLicenciaRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def list(self, tenant_id: str) -> list[dict]:
        res = await (
            self._db.table("politicas_licencia")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .execute()
        )
        return res.data or []

    async def get_for_tipo(self, tenant_id: str, tipo_licencia_id: str, convenio_id: str | None = None) -> dict | None:
        """Get policy for a license type, preferring convenio-specific over general."""
        query = (
            self._db.table("politicas_licencia")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("tipo_licencia_id", tipo_licencia_id)
            .eq("is_active", True)
        )
        res = await query.execute()
        rows = res.data or []

        if not rows:
            return None

        # Prefer convenio-specific policy if available
        if convenio_id:
            for row in rows:
                if row.get("convenio_id") == convenio_id:
                    return row

        # Fall back to general policy (convenio_id IS NULL)
        for row in rows:
            if row.get("convenio_id") is None:
                return row

        return rows[0]

    async def create(self, tenant_id: str, data: dict) -> dict:
        payload = {
            "tenant_id": tenant_id,
            "tipo_licencia_id": str(data["tipo_licencia_id"]),
            "convenio_id": str(data["convenio_id"]) if data.get("convenio_id") else None,
            "dias_base": data["dias_base"],
            "reglas_antiguedad": data.get("reglas_antiguedad"),
            "requiere_aprobacion": data.get("requiere_aprobacion", True),
            "dias_aviso_previo": data.get("dias_aviso_previo", 0),
            "aprobador_rol": data.get("aprobador_rol", "rrhh"),
        }
        res = await self._db.table("politicas_licencia").insert(payload).select("*").single().execute()
        return res.data
