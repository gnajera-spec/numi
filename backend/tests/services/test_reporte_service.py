from unittest.mock import AsyncMock

import pytest

from app.services.reporte_service import ReporteService

TENANT_ID = "00000000-0000-0000-0000-000000000010"
_NOW = "2026-05-12T10:00:00+00:00"
_TODAY = "2026-05-12"


def _make_repo(**overrides) -> AsyncMock:
    repo = AsyncMock()
    repo.get_headcount.return_value = 42
    repo.get_licencias_activas_hoy.return_value = 3
    repo.get_licencias_pendientes.return_value = 2
    repo.get_vencimientos_proximos.return_value = 5
    repo.get_recibos_sin_firmar.return_value = 8
    repo.get_comunicados_sin_confirmar.return_value = 14
    repo.get_headcount_por_sede.return_value = [
        {"sede": "Casa Central", "count": 30},
        {"sede": "Sucursal Norte", "count": 12},
    ]
    repo.get_headcount_por_departamento.return_value = [
        {"departamento": "Tecnología", "count": 15},
        {"departamento": "Administración", "count": 10},
    ]
    repo.get_tendencia_licencias.return_value = [
        {"mes": "2026-04", "total": 5, "aprobadas": 4, "rechazadas": 1, "pendientes": 0},
        {"mes": "2026-05", "total": 3, "aprobadas": 2, "rechazadas": 0, "pendientes": 1},
    ]
    repo.get_licencias_para_export.return_value = [
        {
            "numero_solicitud": "LIC-2026-00001",
            "fecha_inicio": "2026-05-01",
            "fecha_fin": "2026-05-05",
            "dias_habiles": 5,
            "estado": "aprobada",
            "canal": "portal",
            "created_at": _NOW,
            "revisado_at": _NOW,
            "comentario_empleado": None,
            "users": {"nombre": "Juan", "apellido": "García", "cuil": "20123456789"},
            "tipos_licencia": {"nombre": "Vacaciones"},
            "revisado_by": {"nombre": "María", "apellido": "López"},
        }
    ]
    repo.get_comunicaciones_para_export.return_value = [
        {
            "id": "00000000-0000-0000-0000-000000000020",
            "titulo": "Aviso importante",
            "tipo": "general",
            "estado": "enviada",
            "enviado_at": _NOW,
            "total_destinatarios": 10,
        }
    ]
    repo.get_metricas_comunicacion.return_value = {"leidos": 8, "confirmados": 6}
    for k, v in overrides.items():
        setattr(repo, k, v)
    return repo


def _make_service(**overrides) -> ReporteService:
    return ReporteService(repo=_make_repo(**overrides))


# ── Dashboard KPIs ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_dashboard_kpis_returns_all_metrics():
    svc = _make_service()
    result = await svc.get_dashboard_kpis(TENANT_ID)
    assert result.headcount == 42
    assert result.licencias_activas_hoy == 3
    assert result.licencias_pendientes_aprobacion == 2
    assert result.vencimientos_proximos_30d == 5
    assert result.recibos_sin_firmar == 8
    assert result.comunicados_sin_confirmar == 14


@pytest.mark.asyncio
async def test_get_dashboard_kpis_all_zeros_when_no_data():
    svc = _make_service(
        get_headcount=AsyncMock(return_value=0),
        get_licencias_activas_hoy=AsyncMock(return_value=0),
        get_licencias_pendientes=AsyncMock(return_value=0),
        get_vencimientos_proximos=AsyncMock(return_value=0),
        get_recibos_sin_firmar=AsyncMock(return_value=0),
        get_comunicados_sin_confirmar=AsyncMock(return_value=0),
    )
    result = await svc.get_dashboard_kpis(TENANT_ID)
    assert result.headcount == 0
    assert result.comunicados_sin_confirmar == 0


# ── Headcount distribución ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_headcount_distribucion_returns_sedes_and_deptos():
    svc = _make_service()
    result = await svc.get_headcount_distribucion(TENANT_ID)
    assert result.total == 42
    assert len(result.por_sede) == 2
    assert result.por_sede[0].sede == "Casa Central"
    assert result.por_sede[0].count == 30
    assert len(result.por_departamento) == 2


# ── Tendencia licencias ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_tendencia_licencias_fills_missing_months():
    svc = _make_service()
    result = await svc.get_tendencia_licencias(TENANT_ID, meses=2)
    assert len(result.tendencia) >= 1
    for item in result.tendencia:
        assert item.total >= 0
        assert item.aprobadas + item.rechazadas + item.pendientes <= item.total


@pytest.mark.asyncio
async def test_get_tendencia_licencias_empty_returns_zeros():
    svc = _make_service(get_tendencia_licencias=AsyncMock(return_value=[]))
    result = await svc.get_tendencia_licencias(TENANT_ID, meses=1)
    assert all(m.total == 0 for m in result.tendencia)


# ── Export licencias CSV ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_export_licencias_csv_has_header_and_row():
    svc = _make_service()
    csv_text = await svc.export_licencias_csv(TENANT_ID, None, None, None)
    lines = csv_text.strip().splitlines()
    assert lines[0].startswith("numero_solicitud")
    assert "LIC-2026-00001" in lines[1]
    assert "García" in lines[1]
    assert "Vacaciones" in lines[1]


@pytest.mark.asyncio
async def test_export_licencias_csv_empty_data_only_header():
    svc = _make_service(get_licencias_para_export=AsyncMock(return_value=[]))
    csv_text = await svc.export_licencias_csv(TENANT_ID, None, None, None)
    lines = csv_text.strip().splitlines()
    assert len(lines) == 1
    assert lines[0].startswith("numero_solicitud")


# ── Export comunicaciones CSV ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_export_comunicaciones_csv_has_metrics():
    svc = _make_service()
    csv_text = await svc.export_comunicaciones_csv(TENANT_ID, None, None)
    lines = csv_text.strip().splitlines()
    assert lines[0].startswith("titulo")
    assert "Aviso importante" in lines[1]
    assert "80.0%" in lines[1]  # tasa lectura: 8/10
    assert "60.0%" in lines[1]  # tasa confirmacion: 6/10


@pytest.mark.asyncio
async def test_export_comunicaciones_csv_zero_destinatarios():
    svc = _make_service(
        get_comunicaciones_para_export=AsyncMock(return_value=[{
            "id": "00000000-0000-0000-0000-000000000020",
            "titulo": "Sin destinatarios",
            "tipo": "general",
            "estado": "enviada",
            "enviado_at": _NOW,
            "total_destinatarios": 0,
        }]),
        get_metricas_comunicacion=AsyncMock(return_value={"leidos": 0, "confirmados": 0}),
    )
    csv_text = await svc.export_comunicaciones_csv(TENANT_ID, None, None)
    assert "0%" in csv_text
