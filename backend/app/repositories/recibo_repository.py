from datetime import datetime, timezone
from uuid import UUID

from supabase._async.client import AsyncClient


class ReciboRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def get(self, recibo_id: str | UUID) -> dict | None:
        res = (
            await self._db.table("recibos")
            .select("*, firmas_electronicas(*), periodos_liquidacion(periodo, descripcion, fecha_limite_firma)")
            .eq("id", str(recibo_id))
            .single()
            .execute()
        )
        return res.data

    async def list_by_user(
        self,
        user_id: str | UUID,
        *,
        estado: str | None = None,
        periodo: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        query = (
            self._db.table("recibos")
            .select("*, firmas_electronicas(*), periodos_liquidacion(periodo, descripcion, fecha_limite_firma)", count="exact")
            .eq("user_id", str(user_id))
        )
        if estado:
            query = query.eq("estado", estado)
        if periodo:
            query = query.eq("periodos_liquidacion.periodo", periodo)

        offset = (page - 1) * page_size
        res = await query.range(offset, offset + page_size - 1).order("created_at", desc=True).execute()
        return res.data or [], res.count or 0

    async def list_dashboard(
        self,
        periodo_id: str | UUID,
        tenant_id: str,
        *,
        estado: str | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        query = (
            self._db.table("recibos")
            .select(
                "id, user_id, estado, notificado_at, visto_at, firmas_electronicas(timestamp_firma), users(first_name, last_name, cuil, colaborador_perfil(legajo))",
                count="exact",
            )
            .eq("periodo_id", str(periodo_id))
            .eq("tenant_id", tenant_id)
        )
        if estado:
            query = query.eq("estado", estado)

        offset = (page - 1) * page_size
        res = await query.range(offset, offset + page_size - 1).order("created_at", desc=True).execute()
        return res.data or [], res.count or 0

    async def create_many(self, records: list[dict]) -> list[dict]:
        res = await self._db.table("recibos").insert(records).select("*").execute()
        return res.data or []

    async def update_estado(self, recibo_id: str | UUID, estado: str) -> dict | None:
        res = (
            await self._db.table("recibos")
            .update({"estado": estado})
            .eq("id", str(recibo_id))
            .select("*, firmas_electronicas(*), periodos_liquidacion(periodo, descripcion, fecha_limite_firma)")
            .single()
            .execute()
        )
        return res.data

    async def set_visto(self, recibo_id: str | UUID) -> None:
        await self._db.table("recibos").update(
            {"visto_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", str(recibo_id)).is_("visto_at", "null").execute()

    async def list_for_export(self, periodo_id: str | UUID, tenant_id: str, estado: str | None = None) -> list[dict]:
        query = (
            self._db.table("recibos")
            .select("estado, notificado_at, firmas_electronicas(canal, timestamp_firma), users(first_name, last_name, cuil, colaborador_perfil(legajo)), periodos_liquidacion(periodo)")
            .eq("periodo_id", str(periodo_id))
            .eq("tenant_id", tenant_id)
        )
        if estado:
            query = query.eq("estado", estado)
        res = await query.order("created_at").execute()
        return res.data or []

    async def list_unsigned_user_ids(self, periodo_id: str | UUID, user_ids: list[str] | None = None) -> list[str]:
        query = (
            self._db.table("recibos")
            .select("user_id")
            .eq("periodo_id", str(periodo_id))
            .neq("estado", "firmado")
        )
        if user_ids:
            query = query.in_("user_id", user_ids)
        res = await query.execute()
        return [r["user_id"] for r in (res.data or [])]

    async def get_by_id_for_user(self, recibo_id: str, user_id: str) -> dict | None:
        res = (
            await self._db.table("recibos")
            .select("*, periodos_liquidacion(periodo, descripcion)")
            .eq("id", recibo_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return res.data

    async def get_latest_unsigned(self, user_id: str, tenant_id: str) -> dict | None:
        res = (
            await self._db.table("recibos")
            .select("*, periodos_liquidacion(periodo, descripcion)")
            .eq("user_id", user_id)
            .eq("tenant_id", tenant_id)
            .neq("estado", "firmado")
            .order("created_at", desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        )
        return res.data

    async def mark_visto(self, recibo_id: str) -> None:
        await self._db.table("recibos").update(
            {"visto_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", recibo_id).is_("visto_at", "null").execute()

    async def create_firma(self, firma_data: dict) -> dict:
        res = await self._db.table("firmas_electronicas").insert(firma_data).select("*").single().execute()
        return res.data
