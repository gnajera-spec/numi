from datetime import datetime, timezone
from uuid import UUID

from supabase._async.client import AsyncClient


_SELECT_FULL = (
    "*, "
    "tipos_licencia(id, codigo, nombre), "
    "documentos_solicitud(*)"
)


class SolicitudLicenciaRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def create(self, data: dict) -> dict:
        payload = {
            "tenant_id": data["tenant_id"],
            "user_id": data["user_id"],
            "tipo_licencia_id": data["tipo_licencia_id"],
            "fecha_inicio": str(data["fecha_inicio"]),
            "fecha_fin": str(data["fecha_fin"]),
            "dias_habiles": data["dias_habiles"],
            "estado": data.get("estado", "pendiente"),
            "comentario_empleado": data.get("comentario_empleado"),
            "canal": data.get("canal", "portal"),
        }
        res = await (
            self._db.table("solicitudes_licencia")
            .insert(payload)
            .select(_SELECT_FULL)
            .single()
            .execute()
        )
        return res.data

    async def get(self, solicitud_id: str | UUID) -> dict | None:
        res = await (
            self._db.table("solicitudes_licencia")
            .select(_SELECT_FULL)
            .eq("id", str(solicitud_id))
            .maybe_single()
            .execute()
        )
        return res.data

    async def list_all(
        self,
        tenant_id: str,
        *,
        estado: str | None = None,
        tipo_licencia_id: str | None = None,
        user_id: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        query = (
            self._db.table("solicitudes_licencia")
            .select(_SELECT_FULL, count="exact")
            .eq("tenant_id", tenant_id)
        )
        if estado:
            query = query.eq("estado", estado)
        if tipo_licencia_id:
            query = query.eq("tipo_licencia_id", tipo_licencia_id)
        if user_id:
            query = query.eq("user_id", user_id)

        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1).order("created_at", desc=True)
        res = await query.execute()
        return res.data or [], res.count or 0

    async def list_by_user(
        self,
        user_id: str | UUID,
        tenant_id: str,
        *,
        estado: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        query = (
            self._db.table("solicitudes_licencia")
            .select(_SELECT_FULL, count="exact")
            .eq("user_id", str(user_id))
            .eq("tenant_id", tenant_id)
        )
        if estado:
            query = query.eq("estado", estado)

        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1).order("created_at", desc=True)
        res = await query.execute()
        return res.data or [], res.count or 0

    async def has_overlap(
        self,
        user_id: str,
        fecha_inicio: str,
        fecha_fin: str,
        exclude_id: str | None = None,
    ) -> bool:
        """Check if there's an active solicitud overlapping the given date range."""
        query = (
            self._db.table("solicitudes_licencia")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .in_("estado", ["pendiente", "en_revision", "aprobada"])
            .lte("fecha_inicio", fecha_fin)
            .gte("fecha_fin", fecha_inicio)
        )
        if exclude_id:
            query = query.neq("id", exclude_id)
        res = await query.execute()
        return (res.count or 0) > 0

    async def update_estado(
        self,
        solicitud_id: str | UUID,
        estado: str,
        *,
        revisado_por: str | None = None,
        comentario_rrhh: str | None = None,
    ) -> dict | None:
        payload: dict = {
            "estado": estado,
        }
        if revisado_por:
            payload["revisado_por"] = revisado_por
            payload["revisado_at"] = datetime.now(timezone.utc).isoformat()
        if comentario_rrhh is not None:
            payload["comentario_rrhh"] = comentario_rrhh

        res = await (
            self._db.table("solicitudes_licencia")
            .update(payload)
            .eq("id", str(solicitud_id))
            .select(_SELECT_FULL)
            .single()
            .execute()
        )
        return res.data

    async def update(self, data: dict) -> dict | None:
        """Generic update by id. data must include 'id'."""
        solicitud_id = data.pop("id")
        res = await (
            self._db.table("solicitudes_licencia")
            .update(data)
            .eq("id", str(solicitud_id))
            .select(_SELECT_FULL)
            .single()
            .execute()
        )
        return res.data
