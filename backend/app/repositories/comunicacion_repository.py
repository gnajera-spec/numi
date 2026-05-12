from datetime import datetime, timezone

from supabase._async.client import AsyncClient


_SELECT_FULL = "*, comunicacion_adjuntos(*), created_by_user:users!created_by(id, nombre, apellido, email)"


class ComunicacionRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def create(self, data: dict) -> dict:
        payload = {
            "tenant_id": data["tenant_id"],
            "asunto": data["asunto"],
            "cuerpo": data["cuerpo"],
            "tipo_segmento": data["tipo_segmento"],
            "segmento_config": data.get("segmento_config", {}),
            "requiere_confirmacion": data.get("requiere_confirmacion", False),
            "programado_at": data.get("programado_at"),
            "estado": "borrador",
            "created_by": data["created_by"],
        }
        res = await (
            self._db.table("comunicaciones")
            .insert(payload)
            .select(_SELECT_FULL)
            .single()
            .execute()
        )
        return res.data

    async def get(self, comunicacion_id: str, tenant_id: str) -> dict | None:
        res = await (
            self._db.table("comunicaciones")
            .select(_SELECT_FULL)
            .eq("id", comunicacion_id)
            .eq("tenant_id", tenant_id)
            .maybe_single()
            .execute()
        )
        return res.data

    async def list_by_tenant(
        self,
        tenant_id: str,
        estado: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[dict], int]:
        q = (
            self._db.table("comunicaciones")
            .select("id, asunto, tipo_segmento, estado, total_destinatarios, enviado_at, created_at", count="exact")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if estado:
            q = q.eq("estado", estado)
        res = await q.execute()
        return res.data or [], res.count or 0

    async def update_estado(
        self,
        comunicacion_id: str,
        tenant_id: str,
        estado: str,
        extra: dict | None = None,
    ) -> dict:
        payload: dict = {"estado": estado}
        if extra:
            payload.update(extra)
        res = await (
            self._db.table("comunicaciones")
            .update(payload)
            .eq("id", comunicacion_id)
            .eq("tenant_id", tenant_id)
            .select(_SELECT_FULL)
            .single()
            .execute()
        )
        return res.data

    async def set_enviado(
        self, comunicacion_id: str, tenant_id: str, total: int
    ) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        return await self.update_estado(
            comunicacion_id,
            tenant_id,
            "enviando",
            {"enviado_at": now, "total_destinatarios": total},
        )

    async def mark_enviado_completo(self, comunicacion_id: str, tenant_id: str) -> None:
        await self.update_estado(comunicacion_id, tenant_id, "enviado")
