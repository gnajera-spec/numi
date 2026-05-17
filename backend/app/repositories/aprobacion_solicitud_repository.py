from supabase._async.client import AsyncClient


class AprobacionSolicitudRepository:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    async def create_many(self, rows: list[dict]) -> list[dict]:
        response = (
            await self._db.table("aprobaciones_solicitud")
            .insert(rows)
            .select()
            .execute()
        )
        return response.data or []

    async def get_by_solicitud(self, solicitud_id: str) -> list[dict]:
        response = (
            await self._db.table("aprobaciones_solicitud")
            .select("*, users!aprobado_por(nombre, apellido)")
            .eq("solicitud_id", solicitud_id)
            .order("orden")
            .execute()
        )
        rows = response.data or []
        for row in rows:
            user = row.pop("users", None)
            if user:
                row["aprobado_por_nombre"] = f"{user['nombre']} {user['apellido']}"
            else:
                row["aprobado_por_nombre"] = None
        return rows

    async def get_current_paso(self, solicitud_id: str, orden: int) -> dict | None:
        response = (
            await self._db.table("aprobaciones_solicitud")
            .select("*")
            .eq("solicitud_id", solicitud_id)
            .eq("orden", orden)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    async def update_paso(self, aprobacion_id: str, data: dict) -> dict | None:
        response = (
            await self._db.table("aprobaciones_solicitud")
            .update(data)
            .eq("id", aprobacion_id)
            .select()
            .execute()
        )
        return response.data[0] if response.data else None

    async def mark_remaining_omitido(self, solicitud_id: str, desde_orden: int) -> None:
        """Mark all steps after 'desde_orden' as omitido (when rejected or cancelled)."""
        await (
            self._db.table("aprobaciones_solicitud")
            .update({"estado": "omitido"})
            .eq("solicitud_id", solicitud_id)
            .eq("estado", "pendiente")
            .gt("orden", desde_orden)
            .execute()
        )

    async def get_pendientes_para_rol(
        self,
        tenant_id: str,
        rol: str,
        page: int,
        page_size: int,
    ) -> tuple[list[dict], int]:
        """Solicitudes in pendiente where current step matches this role.
        Includes 'solo_ver' steps so the assignee is notified; mi_tipo_accion
        is injected into each solicitud dict so the service can surface it."""
        offset = (page - 1) * page_size
        response = (
            await self._db.table("aprobaciones_solicitud")
            .select(
                "solicitud_id, tipo_accion, solicitudes_licencia!inner(*, tipos_licencia(nombre, codigo, es_medica), users!solicitudes_licencia_user_id_fkey(first_name, last_name, cuil))",
                count="exact",
            )
            .eq("tenant_id", tenant_id)
            .eq("tipo_aprobador", "rol")
            .eq("rol_aprobador", rol)
            .eq("estado", "pendiente")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        items = []
        for row in (response.data or []):
            sol = dict(row["solicitudes_licencia"])
            sol["_mi_tipo_accion"] = row.get("tipo_accion", "aprobar")
            items.append(sol)
        return items, response.count or 0

    async def get_pendientes_para_departamento(
        self,
        tenant_id: str,
        departamento_id: str,
        exclude_user_id: str,
        page: int,
        page_size: int,
    ) -> tuple[list[dict], int]:
        """Solicitudes in pendiente where current step is this departamento, excluding own."""
        offset = (page - 1) * page_size
        response = (
            await self._db.table("aprobaciones_solicitud")
            .select(
                "solicitud_id, tipo_accion, solicitudes_licencia!inner(*, tipos_licencia(nombre, codigo), users!solicitudes_licencia_user_id_fkey(first_name, last_name, cuil))",
                count="exact",
            )
            .eq("tenant_id", tenant_id)
            .eq("tipo_aprobador", "departamento")
            .eq("departamento_id", departamento_id)
            .eq("estado", "pendiente")
            .neq("solicitudes_licencia.user_id", exclude_user_id)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        items = []
        for row in (response.data or []):
            sol = dict(row["solicitudes_licencia"])
            sol["_mi_tipo_accion"] = row.get("tipo_accion", "aprobar")
            items.append(sol)
        return items, response.count or 0
