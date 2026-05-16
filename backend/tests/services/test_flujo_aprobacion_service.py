"""Tests for FlujoAprobacionService."""
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.flujo_aprobacion_service import FlujoAprobacionService
from app.schemas.flujos_aprobacion import FlujoAprobacionCreate, PasoFlujoCreate, FlujoAprobacionUpdate


TENANT_ID = "00000000-0000-0000-0000-000000000001"
ADMIN_ID = "00000000-0000-0000-0000-000000000002"
TIPO_ID = "00000000-0000-0000-0000-000000000003"
FLUJO_ID = "00000000-0000-0000-0000-000000000004"
PASO_ID = "00000000-0000-0000-0000-000000000005"


def _make_service(flujo_repo=None, aprobacion_repo=None):
    flujo_repo = flujo_repo or AsyncMock()
    aprobacion_repo = aprobacion_repo or AsyncMock()
    return FlujoAprobacionService(flujo_repo=flujo_repo, aprobacion_repo=aprobacion_repo)


def _make_flujo_row(**kwargs):
    return {
        "id": FLUJO_ID,
        "tenant_id": TENANT_ID,
        "tipo_licencia_id": TIPO_ID,
        "nombre": "Flujo Test",
        "descripcion": None,
        "is_active": True,
        "created_by": ADMIN_ID,
        "created_at": "2026-05-16T00:00:00+00:00",
        "updated_at": "2026-05-16T00:00:00+00:00",
        **kwargs,
    }


def _make_paso_row(**kwargs):
    return {
        "id": PASO_ID,
        "flujo_id": FLUJO_ID,
        "tenant_id": TENANT_ID,
        "orden": 1,
        "nombre": "Aprobación RRHH",
        "tipo_aprobador": "rol",
        "rol_aprobador": "rrhh",
        "departamento_id": None,
        "departamento_nombre": None,
        "sla_horas": None,
        "requiere_comentario": False,
        "created_at": "2026-05-16T00:00:00+00:00",
        **kwargs,
    }


# ─── Schema validation ────────────────────────────────────────────────────────

def test_paso_flujo_create_rol_valido():
    paso = PasoFlujoCreate(
        orden=1, nombre="Paso 1", tipo_aprobador="rol",
        rol_aprobador="rrhh",
    )
    assert paso.rol_aprobador == "rrhh"
    assert paso.departamento_id is None


def test_paso_flujo_create_rol_invalido_raises():
    with pytest.raises(Exception):
        PasoFlujoCreate(
            orden=1, nombre="Paso 1", tipo_aprobador="rol",
            rol_aprobador="colaborador",  # invalid
        )


def test_paso_flujo_create_departamento_sin_id_raises():
    with pytest.raises(Exception):
        PasoFlujoCreate(
            orden=1, nombre="Paso 1", tipo_aprobador="departamento",
            rol_aprobador="rrhh",  # should not have rol_aprobador
        )


def test_flujo_create_pasos_no_contiguos_raises():
    with pytest.raises(Exception):
        FlujoAprobacionCreate(
            tipo_licencia_id=TIPO_ID,
            nombre="Test",
            pasos=[
                PasoFlujoCreate(orden=1, nombre="P1", tipo_aprobador="rol", rol_aprobador="rrhh"),
                PasoFlujoCreate(orden=3, nombre="P3", tipo_aprobador="rol", rol_aprobador="rrhh"),  # gap!
            ],
        )


# ─── Service: create_flujo ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_flujo_ok():
    flujo_repo = AsyncMock()
    flujo_repo.get_active_for_tipo.return_value = None
    flujo_row = _make_flujo_row()
    flujo_repo.create.return_value = flujo_row
    flujo_repo.create_paso.return_value = _make_paso_row()
    flujo_repo.get_pasos.return_value = [_make_paso_row()]

    svc = _make_service(flujo_repo=flujo_repo)

    data = FlujoAprobacionCreate(
        tipo_licencia_id=TIPO_ID,
        nombre="Flujo Test",
        pasos=[PasoFlujoCreate(orden=1, nombre="RRHH", tipo_aprobador="rol", rol_aprobador="rrhh")],
    )
    result = await svc.create_flujo(TENANT_ID, ADMIN_ID, data)

    flujo_repo.create.assert_awaited_once()
    flujo_repo.create_paso.assert_awaited_once()
    assert result.nombre == "Flujo Test"
    assert len(result.pasos) == 1


@pytest.mark.asyncio
async def test_create_flujo_conflicto_cuando_ya_existe_activo():
    from fastapi import HTTPException
    flujo_repo = AsyncMock()
    flujo_repo.get_active_for_tipo.return_value = _make_flujo_row()

    svc = _make_service(flujo_repo=flujo_repo)
    data = FlujoAprobacionCreate(
        tipo_licencia_id=TIPO_ID,
        nombre="Nuevo flujo",
        pasos=[PasoFlujoCreate(orden=1, nombre="RRHH", tipo_aprobador="rol", rol_aprobador="rrhh")],
    )
    with pytest.raises(HTTPException) as exc_info:
        await svc.create_flujo(TENANT_ID, ADMIN_ID, data)
    assert exc_info.value.status_code == 409


# ─── Service: deactivate_flujo ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_deactivate_flujo_ok():
    flujo_repo = AsyncMock()
    flujo_repo.get_by_id.return_value = _make_flujo_row()
    flujo_repo.count_active_solicitudes.return_value = 0
    flujo_repo.deactivate.return_value = _make_flujo_row(is_active=False)
    flujo_repo.get_pasos.return_value = [_make_paso_row()]

    svc = _make_service(flujo_repo=flujo_repo)
    result = await svc.deactivate_flujo(FLUJO_ID, TENANT_ID)
    assert result.is_active is False


@pytest.mark.asyncio
async def test_deactivate_flujo_ya_inactivo_raises():
    from fastapi import HTTPException
    flujo_repo = AsyncMock()
    flujo_repo.get_by_id.return_value = _make_flujo_row(is_active=False)

    svc = _make_service(flujo_repo=flujo_repo)
    with pytest.raises(HTTPException) as exc_info:
        await svc.deactivate_flujo(FLUJO_ID, TENANT_ID)
    assert exc_info.value.status_code == 409


# ─── Service: update_flujo ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_flujo_con_solicitudes_activas_raises():
    from fastapi import HTTPException
    flujo_repo = AsyncMock()
    flujo_repo.get_by_id.return_value = _make_flujo_row()
    flujo_repo.count_active_solicitudes.return_value = 2

    svc = _make_service(flujo_repo=flujo_repo)
    data = FlujoAprobacionUpdate(nombre="Nuevo nombre")
    with pytest.raises(HTTPException) as exc_info:
        await svc.update_flujo(FLUJO_ID, TENANT_ID, data)
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_update_flujo_sin_solicitudes_ok():
    flujo_repo = AsyncMock()
    flujo_repo.get_by_id.return_value = _make_flujo_row()
    flujo_repo.count_active_solicitudes.return_value = 0
    flujo_repo.update.return_value = _make_flujo_row(nombre="Nuevo nombre")
    flujo_repo.get_pasos.return_value = [_make_paso_row()]

    svc = _make_service(flujo_repo=flujo_repo)
    data = FlujoAprobacionUpdate(nombre="Nuevo nombre")
    result = await svc.update_flujo(FLUJO_ID, TENANT_ID, data)
    assert result.nombre == "Nuevo nombre"


# ─── Service: list_tipos_con_flujo ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_tipos_con_flujo_returns_default_when_no_flujo():
    flujo_repo = AsyncMock()
    flujo_repo.list_tipos_licencia.return_value = [
        {"id": TIPO_ID, "nombre": "Vacaciones", "codigo": "VAC"},
    ]
    flujo_repo.list_active_flujos.return_value = []

    svc = _make_service(flujo_repo=flujo_repo)
    result = await svc.list_tipos_con_flujo(TENANT_ID)

    assert len(result) == 1
    assert result[0].flujo_id is None
    assert result[0].is_active is None
    assert result[0].tipo_licencia_codigo == "VAC"


@pytest.mark.asyncio
async def test_list_tipos_con_flujo_returns_active_flujo():
    flujo_repo = AsyncMock()
    flujo_repo.list_tipos_licencia.return_value = [
        {"id": TIPO_ID, "nombre": "Vacaciones", "codigo": "VAC"},
    ]
    flujo_repo.list_active_flujos.return_value = [
        {
            "id": FLUJO_ID,
            "tipo_licencia_id": TIPO_ID,
            "nombre": "Flujo VAC",
            "is_active": True,
            "pasos_count": 1,
        }
    ]

    svc = _make_service(flujo_repo=flujo_repo)
    result = await svc.list_tipos_con_flujo(TENANT_ID)

    assert len(result) == 1
    assert str(result[0].flujo_id) == FLUJO_ID
    assert result[0].flujo_nombre == "Flujo VAC"
    assert result[0].pasos_count == 1
    assert result[0].is_active is True
