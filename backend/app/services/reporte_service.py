"""
Reporte service: dashboard KPIs, distribución headcount,
tendencia licencias, exports CSV.
Acceso: rrhh, admin_empresa, super_admin.
"""
import csv
import io
import logging
import math
from datetime import date, timedelta

from app.repositories.reportes_repository import ReportesRepository
from app.schemas.reportes import (
    DashboardKPIs,
    DepartamentoCount,
    HeadcountDistribucion,
    SedeCount,
    TendenciaLicencias,
    TendenciaMes,
)

logger = logging.getLogger(__name__)


class ReporteService:
    def __init__(self, repo: ReportesRepository) -> None:
        self._repo = repo

    async def get_dashboard_kpis(self, tenant_id: str) -> DashboardKPIs:
        (
            headcount,
            licencias_hoy,
            licencias_pendientes,
            vencimientos,
            recibos_sin_firmar,
            comunicados,
        ) = await _gather(
            self._repo.get_headcount(tenant_id),
            self._repo.get_licencias_activas_hoy(tenant_id),
            self._repo.get_licencias_pendientes(tenant_id),
            self._repo.get_vencimientos_proximos(tenant_id),
            self._repo.get_recibos_sin_firmar(tenant_id),
            self._repo.get_comunicados_sin_confirmar(tenant_id),
        )
        return DashboardKPIs(
            headcount=headcount,
            licencias_activas_hoy=licencias_hoy,
            licencias_pendientes_aprobacion=licencias_pendientes,
            vencimientos_proximos_30d=vencimientos,
            recibos_sin_firmar=recibos_sin_firmar,
            comunicados_sin_confirmar=comunicados,
        )

    async def get_headcount_distribucion(self, tenant_id: str) -> HeadcountDistribucion:
        headcount, por_sede, por_dpto = await _gather(
            self._repo.get_headcount(tenant_id),
            self._repo.get_headcount_por_sede(tenant_id),
            self._repo.get_headcount_por_departamento(tenant_id),
        )
        return HeadcountDistribucion(
            total=headcount,
            por_sede=[SedeCount(**s) for s in por_sede],
            por_departamento=[DepartamentoCount(**d) for d in por_dpto],
        )

    async def get_tendencia_licencias(
        self, tenant_id: str, meses: int = 6
    ) -> TendenciaLicencias:
        hoy = date.today()
        desde = (hoy.replace(day=1) - timedelta(days=30 * (meses - 1))).replace(day=1)
        rows = await self._repo.get_tendencia_licencias(
            tenant_id, desde.isoformat(), hoy.isoformat()
        )
        # Rellenar meses sin datos
        all_months: list[str] = []
        cursor = desde
        while cursor <= hoy:
            all_months.append(cursor.strftime("%Y-%m"))
            # avanzar al siguiente mes
            if cursor.month == 12:
                cursor = cursor.replace(year=cursor.year + 1, month=1)
            else:
                cursor = cursor.replace(month=cursor.month + 1)

        rows_by_mes = {r["mes"]: r for r in rows}
        tendencia = []
        for mes in all_months:
            if mes in rows_by_mes:
                r = rows_by_mes[mes]
                tendencia.append(TendenciaMes(
                    mes=mes,
                    total=r["total"],
                    aprobadas=r["aprobadas"],
                    rechazadas=r["rechazadas"],
                    pendientes=r["pendientes"],
                ))
            else:
                tendencia.append(TendenciaMes(
                    mes=mes, total=0, aprobadas=0, rechazadas=0, pendientes=0
                ))
        return TendenciaLicencias(tendencia=tendencia)

    async def export_licencias_csv(
        self,
        tenant_id: str,
        desde: str | None,
        hasta: str | None,
        estado: str | None,
    ) -> str:
        rows = await self._repo.get_licencias_para_export(tenant_id, desde, hasta, estado)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "numero_solicitud", "colaborador", "cuil",
            "tipo_licencia", "fecha_inicio", "fecha_fin",
            "dias_habiles", "estado", "canal", "creado_at",
            "revisado_por", "revisado_at",
        ])
        for row in rows:
            user = row.get("users") or {}
            colaborador = f"{user.get('apellido', '')} {user.get('nombre', '')}".strip()
            tipo = (row.get("tipos_licencia") or {}).get("nombre", "")
            revisado_by = row.get("revisado_by") or {}
            revisado_nombre = (
                f"{revisado_by.get('apellido', '')} {revisado_by.get('nombre', '')}".strip()
                if revisado_by else ""
            )
            writer.writerow([
                row.get("numero_solicitud", ""),
                colaborador,
                user.get("cuil", ""),
                tipo,
                row.get("fecha_inicio", ""),
                row.get("fecha_fin", ""),
                row.get("dias_habiles", ""),
                row.get("estado", ""),
                row.get("canal", ""),
                row.get("created_at", ""),
                revisado_nombre,
                row.get("revisado_at", ""),
            ])
        return output.getvalue()

    async def export_comunicaciones_csv(
        self,
        tenant_id: str,
        desde: str | None,
        hasta: str | None,
    ) -> str:
        rows = await self._repo.get_comunicaciones_para_export(tenant_id, desde, hasta)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "titulo", "tipo", "estado", "enviado_at",
            "total_destinatarios", "leidos", "confirmados",
            "tasa_lectura", "tasa_confirmacion",
        ])
        for row in rows:
            total = row.get("total_destinatarios") or 0
            metricas = await self._repo.get_metricas_comunicacion(str(row["id"]))
            leidos = metricas["leidos"]
            confirmados = metricas["confirmados"]
            tasa_lect = f"{round(leidos / total * 100, 1)}%" if total else "0%"
            tasa_conf = f"{round(confirmados / total * 100, 1)}%" if total else "0%"
            writer.writerow([
                row.get("titulo", ""),
                row.get("tipo", ""),
                row.get("estado", ""),
                row.get("enviado_at", ""),
                total,
                leidos,
                confirmados,
                tasa_lect,
                tasa_conf,
            ])
        return output.getvalue()


async def _gather(*coros):
    """Ejecuta coroutines concurrentemente."""
    import asyncio
    return await asyncio.gather(*coros)
