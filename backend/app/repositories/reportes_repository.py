"""
Repositorio de reportes: consultas agregadas para el dashboard RRHH.
Solo lectura — no modifica datos.
"""
from datetime import date, timedelta

from supabase._async.client import AsyncClient


class ReportesRepository:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    async def get_headcount(self, tenant_id: str) -> int:
        resp = await self._db.table("users").select(
            "id", count="exact"
        ).eq("tenant_id", tenant_id).eq("estado", "activo").eq("role", "colaborador").execute()
        return resp.count or 0

    async def get_licencias_activas_hoy(self, tenant_id: str) -> int:
        today = date.today().isoformat()
        resp = await self._db.table("solicitudes_licencia").select(
            "id", count="exact"
        ).eq("tenant_id", tenant_id).eq("estado", "aprobada").lte(
            "fecha_inicio", today
        ).gte("fecha_fin", today).execute()
        return resp.count or 0

    async def get_licencias_pendientes(self, tenant_id: str) -> int:
        resp = await self._db.table("solicitudes_licencia").select(
            "id", count="exact"
        ).eq("tenant_id", tenant_id).eq("estado", "pendiente").execute()
        return resp.count or 0

    async def get_vencimientos_proximos(self, tenant_id: str, dias: int = 30) -> int:
        today = date.today()
        limite = (today + timedelta(days=dias)).isoformat()
        today_str = today.isoformat()
        resp = await self._db.table("aptitudes_laborales").select(
            "id", count="exact"
        ).eq("tenant_id", tenant_id).eq("apto", True).gte(
            "valida_hasta", today_str
        ).lte("valida_hasta", limite).execute()
        return resp.count or 0

    async def get_recibos_sin_firmar(self, tenant_id: str) -> int:
        # Obtener el período más reciente activo
        per_resp = await self._db.table("periodos_liquidacion").select("id").eq(
            "tenant_id", tenant_id
        ).eq("estado", "activo").order("created_at", desc=True).limit(1).execute()
        if not per_resp.data:
            return 0
        periodo_id = per_resp.data[0]["id"]
        resp = await self._db.table("recibos").select(
            "id", count="exact"
        ).eq("tenant_id", tenant_id).eq("periodo_id", periodo_id).is_(
            "firmado_at", "null"
        ).execute()
        return resp.count or 0

    async def get_comunicados_sin_confirmar(self, tenant_id: str) -> int:
        resp = await self._db.table("comunicacion_destinatarios").select(
            "id", count="exact"
        ).eq("tenant_id", tenant_id).eq("confirmado", False).execute()
        return resp.count or 0

    async def get_headcount_por_sede(self, tenant_id: str) -> list[dict]:
        resp = await self._db.table("users").select(
            "sede_id, sedes(nombre)"
        ).eq("tenant_id", tenant_id).eq("estado", "activo").eq(
            "role", "colaborador"
        ).execute()
        counts: dict[str, int] = {}
        for row in (resp.data or []):
            nombre = (row.get("sedes") or {}).get("nombre") or "Sin sede"
            counts[nombre] = counts.get(nombre, 0) + 1
        return [{"sede": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])]

    async def get_headcount_por_departamento(self, tenant_id: str) -> list[dict]:
        resp = await self._db.table("users").select(
            "departamento_id, departamentos(nombre)"
        ).eq("tenant_id", tenant_id).eq("estado", "activo").eq(
            "role", "colaborador"
        ).execute()
        counts: dict[str, int] = {}
        for row in (resp.data or []):
            nombre = (row.get("departamentos") or {}).get("nombre") or "Sin departamento"
            counts[nombre] = counts.get(nombre, 0) + 1
        return [{"departamento": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])]

    async def get_tendencia_licencias(
        self, tenant_id: str, desde: str, hasta: str
    ) -> list[dict]:
        resp = await self._db.table("solicitudes_licencia").select(
            "estado, fecha_inicio"
        ).eq("tenant_id", tenant_id).gte("fecha_inicio", desde).lte(
            "fecha_inicio", hasta
        ).execute()
        rows = resp.data or []
        mes_data: dict[str, dict] = {}
        for row in rows:
            mes = row["fecha_inicio"][:7]  # YYYY-MM
            if mes not in mes_data:
                mes_data[mes] = {"total": 0, "aprobadas": 0, "rechazadas": 0, "pendientes": 0}
            mes_data[mes]["total"] += 1
            estado = row["estado"]
            if estado == "aprobada":
                mes_data[mes]["aprobadas"] += 1
            elif estado == "rechazada":
                mes_data[mes]["rechazadas"] += 1
            elif estado == "pendiente":
                mes_data[mes]["pendientes"] += 1
        return [{"mes": k, **v} for k, v in sorted(mes_data.items())]

    async def get_licencias_para_export(
        self,
        tenant_id: str,
        desde: str | None,
        hasta: str | None,
        estado: str | None,
    ) -> list[dict]:
        q = self._db.table("solicitudes_licencia").select(
            "numero_solicitud, fecha_inicio, fecha_fin, dias_habiles, estado, canal, created_at, revisado_at, comentario_empleado, "
            "users!solicitudes_licencia_user_id_fkey(nombre, apellido, cuil), "
            "tipos_licencia(nombre), "
            "revisado_by:users!solicitudes_licencia_revisado_por_fkey(nombre, apellido)"
        ).eq("tenant_id", tenant_id).order("created_at", desc=True)
        if desde:
            q = q.gte("fecha_inicio", desde)
        if hasta:
            q = q.lte("fecha_inicio", hasta)
        if estado:
            q = q.eq("estado", estado)
        resp = await q.execute()
        return resp.data or []

    async def get_comunicaciones_para_export(
        self,
        tenant_id: str,
        desde: str | None,
        hasta: str | None,
    ) -> list[dict]:
        q = self._db.table("comunicaciones").select(
            "id, titulo, tipo, estado, enviado_at, total_destinatarios"
        ).eq("tenant_id", tenant_id).order("enviado_at", desc=True)
        if desde:
            q = q.gte("enviado_at", desde)
        if hasta:
            q = q.lte("enviado_at", hasta + "T23:59:59")
        resp = await q.execute()
        return resp.data or []

    async def get_metricas_comunicacion(self, comunicacion_id: str) -> dict:
        resp = await self._db.table("comunicacion_destinatarios").select(
            "leido, confirmado"
        ).eq("comunicacion_id", comunicacion_id).execute()
        rows = resp.data or []
        leidos = sum(1 for r in rows if r.get("leido"))
        confirmados = sum(1 for r in rows if r.get("confirmado"))
        return {"leidos": leidos, "confirmados": confirmados}
