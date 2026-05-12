from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.medico import (
    AccidenteCreate,
    AccidenteUpdate,
    AptitudCreate,
    ExamenCreate,
    FichaMedicaUpdate,
    VacunacionCreate,
)
from app.services.medico_service import MedicoService

TENANT_ID  = "00000000-0000-0000-0000-000000000010"
USER_ID    = "00000000-0000-0000-0000-000000000011"
MEDICO_ID  = "00000000-0000-0000-0000-000000000099"
ACC_ID     = "00000000-0000-0000-0000-000000000030"
PUESTO_ID  = "00000000-0000-0000-0000-000000000050"
_NOW       = "2026-05-12T10:00:00+00:00"
_TODAY     = "2026-05-12"


def _make_settings():
    s = MagicMock()
    s.encryption_key = "0" * 64
    return s


def _make_ficha_row(**kwargs):
    return {
        "id": "00000000-0000-0000-0000-000000000020",
        "tenant_id": TENANT_ID,
        "user_id": USER_ID,
        "grupo_sanguineo": "O+",
        "factor_rh": "positivo",
        "alergias_encrypted": None,
        "condiciones_encrypted": None,
        "observaciones": None,
        "created_at": _NOW,
        "updated_at": _NOW,
        **kwargs,
    }


def _make_examen_row(**kwargs):
    return {
        "id": "00000000-0000-0000-0000-000000000021",
        "tenant_id": TENANT_ID,
        "user_id": USER_ID,
        "tipo": "ingreso",
        "fecha": _TODAY,
        "resultado": None,
        "medico_responsable": "Dr. López",
        "storage_path": None,
        "created_by": MEDICO_ID,
        "created_at": _NOW,
        **kwargs,
    }


def _make_accidente_row(**kwargs):
    return {
        "id": ACC_ID,
        "tenant_id": TENANT_ID,
        "user_id": USER_ID,
        "fecha_hora": _NOW,
        "lugar": "Planta baja",
        "descripcion": "Caída en escalera",
        "testigos": None,
        "numero_art": None,
        "estado": "abierto",
        "created_by": MEDICO_ID,
        "created_at": _NOW,
        "updated_at": _NOW,
        **kwargs,
    }


def _make_aptitud_row(**kwargs):
    return {
        "id": "00000000-0000-0000-0000-000000000022",
        "tenant_id": TENANT_ID,
        "user_id": USER_ID,
        "puesto_id": PUESTO_ID,
        "estado": "apto",
        "restricciones": None,
        "fecha_emision": _TODAY,
        "fecha_vencimiento": None,
        "emitido_por": MEDICO_ID,
        "created_at": _NOW,
        **kwargs,
    }


def _make_service(**overrides) -> MedicoService:
    fichas = AsyncMock()
    fichas.get.return_value = _make_ficha_row()
    fichas.upsert.return_value = _make_ficha_row()
    fichas.list_with_users.return_value = ([], 0)

    examenes = AsyncMock()
    examenes.create.return_value = _make_examen_row()
    examenes.list_by_user.return_value = [_make_examen_row()]
    examenes.update_storage_path.return_value = None

    vacunaciones = AsyncMock()
    vacunaciones.create.return_value = {
        "id": "00000000-0000-0000-0000-000000000023",
        "tenant_id": TENANT_ID,
        "user_id": USER_ID,
        "vacuna": "Hepatitis B",
        "fecha": _TODAY,
        "lote": None,
        "proxima_dosis": None,
        "created_by": MEDICO_ID,
        "created_at": _NOW,
    }
    vacunaciones.list_by_user.return_value = []

    aptitudes = AsyncMock()
    aptitudes.create.return_value = _make_aptitud_row()
    aptitudes.list_by_user.return_value = [_make_aptitud_row()]
    aptitudes.list_por_vencer.return_value = []

    accidentes = AsyncMock()
    accidentes.create.return_value = _make_accidente_row()
    accidentes.get.return_value = _make_accidente_row()
    accidentes.list_by_tenant.return_value = ([_make_accidente_row()], 1)
    accidentes.update.return_value = _make_accidente_row(estado="tratamiento")

    kwargs = dict(
        db=MagicMock(),
        settings=_make_settings(),
        fichas=fichas,
        examenes=examenes,
        vacunaciones=vacunaciones,
        aptitudes=aptitudes,
        accidentes=accidentes,
    )
    kwargs.update(overrides)
    return MedicoService(**kwargs)


# ── fichas ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_ficha_returns_out():
    svc = _make_service()
    result = await svc.get_ficha(USER_ID, TENANT_ID)
    assert str(result.user_id) == USER_ID
    assert result.grupo_sanguineo == "O+"


@pytest.mark.asyncio
async def test_get_ficha_not_found_raises_404():
    svc = _make_service()
    svc._fichas.get.return_value = None
    with pytest.raises(Exception) as exc_info:
        await svc.get_ficha(USER_ID, TENANT_ID)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_upsert_ficha_encripts_alergias():
    svc = _make_service()
    body = FichaMedicaUpdate(alergias=[{"nombre": "Penicilina", "severidad": "alta"}])
    result = await svc.upsert_ficha(USER_ID, TENANT_ID, body)
    svc._fichas.upsert.assert_called_once()
    payload = svc._fichas.upsert.call_args[0][2]
    assert "alergias_encrypted" in payload
    assert result.user_id is not None


@pytest.mark.asyncio
async def test_upsert_ficha_sin_campos_no_llama_upsert_con_extras():
    svc = _make_service()
    body = FichaMedicaUpdate(grupo_sanguineo="A+")
    await svc.upsert_ficha(USER_ID, TENANT_ID, body)
    call_payload = svc._fichas.upsert.call_args[0][2]
    assert "grupo_sanguineo" in call_payload
    assert "alergias_encrypted" not in call_payload


# ── exámenes ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_examenes_returns_list():
    svc = _make_service()
    result = await svc.list_examenes(USER_ID, TENANT_ID)
    assert len(result) == 1
    assert result[0].tipo == "ingreso"


@pytest.mark.asyncio
async def test_create_examen_sin_archivo():
    svc = _make_service()
    body = ExamenCreate(tipo="ingreso", fecha=date(2026, 5, 1))
    result = await svc.create_examen(USER_ID, TENANT_ID, MEDICO_ID, body, None)
    assert result.tipo == "ingreso"
    svc._examenes.update_storage_path.assert_not_called()


@pytest.mark.asyncio
async def test_create_examen_encripta_resultado():
    svc = _make_service()
    body = ExamenCreate(tipo="periodico", fecha=date(2026, 5, 1), resultado="Apto")
    await svc.create_examen(USER_ID, TENANT_ID, MEDICO_ID, body, None)
    call_data = svc._examenes.create.call_args[0][0]
    assert call_data["resultado"] is not None
    assert call_data["resultado"] != "Apto"


# ── aptitudes ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_aptitudes_returns_list():
    svc = _make_service()
    result = await svc.list_aptitudes(USER_ID, TENANT_ID)
    assert len(result) == 1
    assert result[0].estado == "apto"


@pytest.mark.asyncio
async def test_create_aptitud_apto():
    svc = _make_service()
    body = AptitudCreate(
        puesto_id=PUESTO_ID,
        estado="apto",
        fecha_emision=date(2026, 5, 1),
    )
    result = await svc.create_aptitud(USER_ID, TENANT_ID, MEDICO_ID, body)
    assert result.estado == "apto"


@pytest.mark.asyncio
async def test_create_aptitud_con_restricciones_sin_detalle_falla():
    with pytest.raises(Exception):
        AptitudCreate(
            puesto_id=PUESTO_ID,
            estado="apto_con_restricciones",
            fecha_emision=date(2026, 5, 1),
        )


# ── accidentes ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_accidentes_returns_paginated():
    svc = _make_service()
    result = await svc.list_accidentes(TENANT_ID, None, None, None, None, 1, 20)
    assert result.total == 1
    assert result.items[0].estado == "abierto"


@pytest.mark.asyncio
async def test_create_accidente():
    svc = _make_service()
    body = AccidenteCreate(
        user_id=USER_ID,
        fecha_hora="2026-05-12T10:00:00Z",
        lugar="Planta baja",
        descripcion="Caída",
    )
    result = await svc.create_accidente(TENANT_ID, MEDICO_ID, body)
    assert result.estado == "abierto"


@pytest.mark.asyncio
async def test_update_accidente_estado():
    svc = _make_service()
    body = AccidenteUpdate(estado="tratamiento")
    result = await svc.update_accidente(ACC_ID, TENANT_ID, body)
    assert result.estado == "tratamiento"


@pytest.mark.asyncio
async def test_update_accidente_not_found():
    svc = _make_service()
    svc._accidentes.get.return_value = None
    body = AccidenteUpdate(estado="cerrado")
    with pytest.raises(Exception) as exc_info:
        await svc.update_accidente(ACC_ID, TENANT_ID, body)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_update_accidente_sin_payload_falla():
    svc = _make_service()
    body = AccidenteUpdate()
    with pytest.raises(Exception) as exc_info:
        await svc.update_accidente(ACC_ID, TENANT_ID, body)
    assert exc_info.value.status_code == 422


# ── reportes ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reporte_aptitudes_por_vencer_vacio():
    svc = _make_service()
    result = await svc.reporte_aptitudes_por_vencer(TENANT_ID, 30, None, None)
    assert result == []
