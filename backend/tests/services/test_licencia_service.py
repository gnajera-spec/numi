from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.licencias import (
    AprobarSolicitudRequest,
    CreateSolicitudRequest,
    RechazarSolicitudRequest,
)
from app.services.licencia_service import LicenciaService, _calc_dias_habiles

TENANT_ID = "00000000-0000-0000-0000-000000000010"
USER_ID   = "00000000-0000-0000-0000-000000000011"
TIPO_ID   = "00000000-0000-0000-0000-000000000020"
SOL_ID    = "00000000-0000-0000-0000-000000000030"


def _make_tipo(**kwargs) -> dict:
    return {
        "id": TIPO_ID,
        "tenant_id": None,
        "codigo": "VAC",
        "nombre": "Vacaciones anuales",
        "descripcion": None,
        "requiere_certificado": False,
        "es_medica": False,
        "dias_maximos": None,
        "is_active": True,
        **kwargs,
    }


def _make_solicitud(**kwargs) -> dict:
    return {
        "id": SOL_ID,
        "tenant_id": TENANT_ID,
        "numero_solicitud": "LIC-2026-00001",
        "user_id": USER_ID,
        "tipo_licencia_id": TIPO_ID,
        "tipos_licencia": {"id": TIPO_ID, "codigo": "VAC", "nombre": "Vacaciones anuales"},
        "fecha_inicio": date(2026, 6, 1),
        "fecha_fin": date(2026, 6, 5),
        "dias_habiles": 5,
        "estado": "pendiente",
        "comentario_empleado": None,
        "comentario_rrhh": None,
        "revisado_por": None,
        "revisado_at": None,
        "canal": "portal",
        "documentos_solicitud": [],
        "created_at": "2026-06-01T00:00:00+00:00",
        **kwargs,
    }


def _make_user() -> dict:
    return {
        "id": USER_ID,
        "tenant_id": TENANT_ID,
        "email": "colab@empresa.com",
        "first_name": "Juan",
        "last_name": "Perez",
        "role": "colaborador",
        "estado": "activo",
    }


def _make_service(**overrides) -> LicenciaService:
    tipo_repo = AsyncMock()
    tipo_repo.get.return_value = _make_tipo()
    tipo_repo.list.return_value = [_make_tipo()]
    tipo_repo.create.return_value = _make_tipo()

    politica_repo = AsyncMock()
    politica_repo.list.return_value = []
    politica_repo.create.return_value = {}

    solicitud_repo = AsyncMock()
    solicitud_repo.create.return_value = _make_solicitud()
    solicitud_repo.get.return_value = _make_solicitud()
    solicitud_repo.list_all.return_value = ([_make_solicitud()], 1)
    solicitud_repo.list_by_user.return_value = ([_make_solicitud()], 1)
    solicitud_repo.has_overlap.return_value = False
    solicitud_repo.update_estado.return_value = _make_solicitud(estado="aprobada")

    saldo_repo = AsyncMock()
    saldo_repo.add_pendientes.return_value = None
    saldo_repo.subtract_pendientes.return_value = None
    saldo_repo.approve.return_value = None
    saldo_repo.list_for_user.return_value = []

    user_repo = AsyncMock()
    user_repo.get_by_id.return_value = _make_user()

    db = MagicMock()

    kwargs = dict(
        db=db,
        tipo_repo=tipo_repo,
        politica_repo=politica_repo,
        solicitud_repo=solicitud_repo,
        saldo_repo=saldo_repo,
        user_repo=user_repo,
        wa_config_repo=None,
    )
    kwargs.update(overrides)
    return LicenciaService(**kwargs)


# ── _calc_dias_habiles ────────────────────────────────────────────────────────

def test_calc_dias_habiles_weekdays():
    # Monday to Friday = 5 days
    assert _calc_dias_habiles(date(2026, 6, 1), date(2026, 6, 5)) == 5


def test_calc_dias_habiles_skips_weekend():
    # Monday to next Monday = 6 working days
    assert _calc_dias_habiles(date(2026, 6, 1), date(2026, 6, 8)) == 6


def test_calc_dias_habiles_single_day():
    assert _calc_dias_habiles(date(2026, 6, 1), date(2026, 6, 1)) == 1


# ── list_tipos ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_tipos_returns_list():
    svc = _make_service()
    result = await svc.list_tipos(TENANT_ID)
    assert len(result) == 1
    assert result[0].codigo == "VAC"


# ── create_solicitud ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_solicitud_success():
    svc = _make_service()
    current_user = {"id": USER_ID, "tenant_id": TENANT_ID, "role": "colaborador"}
    req = CreateSolicitudRequest(
        tipo_licencia_id=TIPO_ID,
        fecha_inicio=date(2026, 6, 1),
        fecha_fin=date(2026, 6, 5),
    )
    result = await svc.create_solicitud(current_user, req)
    assert result.estado == "pendiente"
    assert result.numero_solicitud == "LIC-2026-00001"


@pytest.mark.asyncio
async def test_create_solicitud_overlap_raises_422():
    svc = _make_service()
    svc._solicitudes.has_overlap.return_value = True
    current_user = {"id": USER_ID, "tenant_id": TENANT_ID, "role": "colaborador"}
    req = CreateSolicitudRequest(
        tipo_licencia_id=TIPO_ID,
        fecha_inicio=date(2026, 6, 1),
        fecha_fin=date(2026, 6, 5),
    )
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await svc.create_solicitud(current_user, req)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_create_solicitud_dias_maximos_exceeded_raises_422():
    svc = _make_service()
    svc._tipos.get.return_value = _make_tipo(dias_maximos=3)
    current_user = {"id": USER_ID, "tenant_id": TENANT_ID, "role": "colaborador"}
    req = CreateSolicitudRequest(
        tipo_licencia_id=TIPO_ID,
        fecha_inicio=date(2026, 6, 1),
        fecha_fin=date(2026, 6, 10),  # 8 working days > 3
    )
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await svc.create_solicitud(current_user, req)
    assert exc_info.value.status_code == 422


# ── aprobar_solicitud ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_aprobar_solicitud_success():
    svc = _make_service()
    rrhh_user = {"id": "00000000-0000-0000-0000-000000000099", "tenant_id": TENANT_ID, "role": "rrhh"}
    req = AprobarSolicitudRequest(comentario="Aprobado")
    result = await svc.aprobar_solicitud(SOL_ID, rrhh_user, req)
    assert result.estado == "aprobada"
    svc._saldos.approve.assert_called_once()


@pytest.mark.asyncio
async def test_aprobar_solicitud_wrong_state_raises_422():
    svc = _make_service()
    svc._solicitudes.get.return_value = _make_solicitud(estado="aprobada")
    rrhh_user = {"id": "00000000-0000-0000-0000-000000000099", "tenant_id": TENANT_ID, "role": "rrhh"}
    req = AprobarSolicitudRequest()
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await svc.aprobar_solicitud(SOL_ID, rrhh_user, req)
    assert exc_info.value.status_code == 422


# ── rechazar_solicitud ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rechazar_solicitud_success():
    svc = _make_service()
    svc._solicitudes.update_estado.return_value = _make_solicitud(estado="rechazada")
    rrhh_user = {"id": "00000000-0000-0000-0000-000000000099", "tenant_id": TENANT_ID, "role": "rrhh"}
    req = RechazarSolicitudRequest(comentario="Fechas no disponibles")
    result = await svc.rechazar_solicitud(SOL_ID, rrhh_user, req)
    assert result.estado == "rechazada"
    svc._saldos.subtract_pendientes.assert_called_once()


# ── cancelar_solicitud ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cancelar_solicitud_success():
    svc = _make_service()
    svc._solicitudes.update_estado.return_value = _make_solicitud(estado="cancelada")
    current_user = {"id": USER_ID, "tenant_id": TENANT_ID, "role": "colaborador"}
    result = await svc.cancelar_solicitud(SOL_ID, current_user)
    assert result.estado == "cancelada"


@pytest.mark.asyncio
async def test_cancelar_solicitud_non_pendiente_raises_422():
    svc = _make_service()
    svc._solicitudes.get.return_value = _make_solicitud(estado="aprobada")
    current_user = {"id": USER_ID, "tenant_id": TENANT_ID, "role": "colaborador"}
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await svc.cancelar_solicitud(SOL_ID, current_user)
    assert exc_info.value.status_code == 422


# ── get_solicitud access control ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_solicitud_colaborador_can_see_own():
    svc = _make_service()
    current_user = {"id": USER_ID, "tenant_id": TENANT_ID, "role": "colaborador"}
    result = await svc.get_solicitud(SOL_ID, current_user)
    assert str(result.id) == SOL_ID


@pytest.mark.asyncio
async def test_get_solicitud_colaborador_cannot_see_others():
    svc = _make_service()
    other_user_id = "00000000-0000-0000-0000-000000000099"
    current_user = {"id": other_user_id, "tenant_id": TENANT_ID, "role": "colaborador"}
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await svc.get_solicitud(SOL_ID, current_user)
    assert exc_info.value.status_code == 403
