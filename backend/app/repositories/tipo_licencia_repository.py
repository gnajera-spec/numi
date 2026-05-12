from uuid import UUID

from supabase._async.client import AsyncClient


class TipoLicenciaRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def list(self, tenant_id: str) -> list[dict]:
        """Returns global types (tenant_id IS NULL) plus tenant-custom types."""
        res = await (
            self._db.table("tipos_licencia")
            .select("*")
            .or_(f"tenant_id.is.null,tenant_id.eq.{tenant_id}")
            .eq("is_active", True)
            .order("codigo")
            .execute()
        )
        return res.data or []

    async def get(self, tipo_id: str | UUID, tenant_id: str) -> dict | None:
        """Returns a type if it's global or belongs to the tenant."""
        res = await (
            self._db.table("tipos_licencia")
            .select("*")
            .eq("id", str(tipo_id))
            .or_(f"tenant_id.is.null,tenant_id.eq.{tenant_id}")
            .maybe_single()
            .execute()
        )
        return res.data

    async def create(self, tenant_id: str, data: dict) -> dict:
        payload = {
            "tenant_id": tenant_id,
            "codigo": data["codigo"],
            "nombre": data["nombre"],
            "descripcion": data.get("descripcion"),
            "requiere_certificado": data.get("requiere_certificado", False),
            "dias_maximos": data.get("dias_maximos"),
        }
        res = await self._db.table("tipos_licencia").insert(payload).select("*").single().execute()
        return res.data
