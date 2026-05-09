import math
from datetime import date
from uuid import UUID

from supabase._async.client import AsyncClient


class PeriodoRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def list(
        self,
        tenant_id: str,
        *,
        estado: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        query = (
            self._db.table("periodos_liquidacion")
            .select("*", count="exact")
            .eq("tenant_id", tenant_id)
        )
        if estado:
            query = query.eq("estado", estado)

        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1).order("created_at", desc=True)
        res = await query.execute()
        return res.data or [], res.count or 0

    async def get(self, periodo_id: str | UUID, tenant_id: str) -> dict | None:
        res = (
            await self._db.table("periodos_liquidacion")
            .select("*")
            .eq("id", str(periodo_id))
            .eq("tenant_id", tenant_id)
            .single()
            .execute()
        )
        return res.data

    async def create(
        self,
        tenant_id: str,
        created_by: str | UUID,
        data: dict,
    ) -> dict:
        payload: dict = {
            "tenant_id": tenant_id,
            "created_by": str(created_by),
            "periodo": data["periodo"],
            "fecha_inicio": data["fecha_inicio"].isoformat() if isinstance(data["fecha_inicio"], date) else data["fecha_inicio"],
            "fecha_fin": data["fecha_fin"].isoformat() if isinstance(data["fecha_fin"], date) else data["fecha_fin"],
        }
        if data.get("descripcion"):
            payload["descripcion"] = data["descripcion"]
        if data.get("fecha_limite_firma"):
            flf = data["fecha_limite_firma"]
            payload["fecha_limite_firma"] = flf.isoformat() if isinstance(flf, date) else flf

        res = await self._db.table("periodos_liquidacion").insert(payload).select("*").single().execute()
        return res.data

    async def update_estado(self, periodo_id: str | UUID, estado: str) -> None:
        await self._db.table("periodos_liquidacion").update(
            {"estado": estado}
        ).eq("id", str(periodo_id)).execute()

    async def increment_total_recibos(self, periodo_id: str | UUID, count: int) -> None:
        # Fetch current and update atomically via RPC or read-modify-write
        res = await self._db.table("periodos_liquidacion").select("total_recibos").eq("id", str(periodo_id)).single().execute()
        current = res.data.get("total_recibos", 0) if res.data else 0
        await self._db.table("periodos_liquidacion").update(
            {"total_recibos": current + count}
        ).eq("id", str(periodo_id)).execute()
