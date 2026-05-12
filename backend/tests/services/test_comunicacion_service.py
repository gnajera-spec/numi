from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.comunicaciones import ComunicacionCreate
from app.services.comunicacion_service import ComunicacionService

TENANT_ID = "00000000-0000-0000-0000-000000000010"
USER_ID   = "00000000-0000-0000-0000-000000000011"
COM_ID    = "00000000-0000-0000-0000-000000000020"
RRHH_ID   = "00000000-0000-0000-0000-000000000099"

_NOW = "2026-05-12T10:00:00+00:00"


def _make_com(**kwargs) -> dict:
    return {
        "id": COM_ID,
        "tenant_id": TENANT_ID,
        "asunto": "Aviso importante",
        "cuerpo": "Este es el cuerpo del aviso.",
        "tipo_segmento": "todos",
        "segmento_config": {},
        "requiere_confirmacion": False,
        "programado_at": None,
        "enviado_at": None,
        "estado": "borrador",
        "total_destinatarios": 0,
        "created_by": RRHH_ID,
        "created_at": _NOW,
        "updated_at": _NOW,
        "comunicacion_adjuntos": [],
        **kwargs,
    }


def _make_service(**overrides) -> ComunicacionService:
    comunicaciones = AsyncMock()
    comunicaciones.create.return_value = _make_com()
    comunicaciones.get.return_value = _make_com()
    comunicaciones.list_by_tenant.return_value = ([_make_com()], 1)
    comunicaciones.set_enviado.return_value = _make_com(estado="enviando", total_destinatarios=2)
    comunicaciones.mark_enviado_completo.return_value = None
    comunicaciones.update_estado.return_value = _make_com(estado="enviado")

    destinatarios = AsyncMock()
    destinatarios.bulk_create.return_value = 2
    destinatarios.get_metricas.return_value = {"enviados": 0, "entregados": 0, "leidos": 0, "confirmados": 0}
    destinatarios.list_by_user.return_value = ([], 0)
    destinatarios.get_for_user.return_value = None
    destinatarios.list_sin_confirmacion.return_value = []

    adjuntos = AsyncMock()
    users = AsyncMock()
    users.list_users.return_value = (
        [{"id": USER_ID}, {"id": "00000000-0000-0000-0000-000000000012"}],
        2,
    )
    wa_config = AsyncMock()
    wa_config.get_by_tenant.return_value = None

    kwargs = dict(
        db=MagicMock(),
        comunicaciones=comunicaciones,
        destinatarios=destinatarios,
        adjuntos=adjuntos,
        users=users,
        wa_config=wa_config,
    )
    kwargs.update(overrides)
    return ComunicacionService(**kwargs)


# ── create ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_returns_comunicacion_out():
    svc = _make_service()
    payload = ComunicacionCreate(
        asunto="Aviso importante",
        cuerpo="Este es el cuerpo del aviso.",
        tipo_segmento="todos",
    )
    result = await svc.create(TENANT_ID, RRHH_ID, payload)
    assert result.asunto == "Aviso importante"
    assert result.estado == "borrador"
    svc._comunicaciones.create.assert_called_once()


@pytest.mark.asyncio
async def test_create_con_segmento_sede_requiere_config():
    with pytest.raises(Exception):
        ComunicacionCreate(
            asunto="Test",
            cuerpo="Cuerpo",
            tipo_segmento="sede",
            segmento_config={},
        )


# ── list_by_tenant ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_by_tenant_paginado():
    svc = _make_service()
    result = await svc.list_by_tenant(TENANT_ID, estado=None, page=1, page_size=20)
    assert result.total == 1
    assert result.page == 1
    assert len(result.items) == 1


# ── get ───────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_returns_comunicacion_con_metricas():
    svc = _make_service()
    result = await svc.get(TENANT_ID, COM_ID)
    assert result.id is not None
    assert result.metricas is not None
    assert result.metricas.enviados == 0


@pytest.mark.asyncio
async def test_get_raises_404_if_not_found():
    svc = _make_service()
    svc._comunicaciones.get.return_value = None
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await svc.get(TENANT_ID, COM_ID)
    assert exc_info.value.status_code == 404


# ── enviar ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_enviar_ok_todos_los_usuarios():
    svc = _make_service()
    result = await svc.enviar(TENANT_ID, COM_ID)
    assert result.total_destinatarios == 2
    assert result.estado == "enviando"
    svc._destinatarios.bulk_create.assert_called_once()
    svc._comunicaciones.mark_enviado_completo.assert_called_once()


@pytest.mark.asyncio
async def test_enviar_raises_422_si_no_borrador():
    from fastapi import HTTPException
    svc = _make_service()
    svc._comunicaciones.get.return_value = _make_com(estado="enviado")
    with pytest.raises(HTTPException) as exc_info:
        await svc.enviar(TENANT_ID, COM_ID)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_enviar_raises_422_si_sin_destinatarios():
    from fastapi import HTTPException
    svc = _make_service()
    svc._users.list_users.return_value = ([], 0)
    with pytest.raises(HTTPException) as exc_info:
        await svc.enviar(TENANT_ID, COM_ID)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_enviar_raises_404_si_no_existe():
    from fastapi import HTTPException
    svc = _make_service()
    svc._comunicaciones.get.return_value = None
    with pytest.raises(HTTPException) as exc_info:
        await svc.enviar(TENANT_ID, COM_ID)
    assert exc_info.value.status_code == 404


# ── reenviar ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reenviar_returns_count():
    svc = _make_service()
    svc._destinatarios.list_sin_confirmacion.return_value = [
        {"user_id": USER_ID, "users": {"whatsapp_id_hash": None}},
    ]
    result = await svc.reenviar(TENANT_ID, COM_ID)
    assert result.reenviados == 1


# ── list_for_colaborador ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_for_colaborador_empty():
    svc = _make_service()
    result = await svc.list_for_colaborador(USER_ID, estado_filter=None, page=1, page_size=20)
    assert result.total == 0
    assert result.items == []


# ── confirmar ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_confirmar_raises_404_si_no_destinatario():
    from fastapi import HTTPException
    svc = _make_service()
    svc._destinatarios.get_for_user.return_value = None
    with pytest.raises(HTTPException) as exc_info:
        await svc.confirmar(COM_ID, USER_ID)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_confirmar_raises_422_si_no_requiere_confirmacion():
    from fastapi import HTTPException
    svc = _make_service()
    svc._destinatarios.get_for_user.return_value = {
        "comunicaciones": {"requiere_confirmacion": False},
        "confirmado_at": None,
    }
    with pytest.raises(HTTPException) as exc_info:
        await svc.confirmar(COM_ID, USER_ID)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_confirmar_raises_422_si_ya_confirmado():
    from fastapi import HTTPException
    svc = _make_service()
    svc._destinatarios.get_for_user.return_value = {
        "comunicaciones": {"requiere_confirmacion": True},
        "confirmado_at": _NOW,
    }
    with pytest.raises(HTTPException) as exc_info:
        await svc.confirmar(COM_ID, USER_ID)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_confirmar_ok():
    svc = _make_service()
    svc._destinatarios.get_for_user.return_value = {
        "comunicaciones": {"requiere_confirmacion": True},
        "confirmado_at": None,
    }
    svc._destinatarios.mark_confirmado.return_value = _NOW
    result = await svc.confirmar(COM_ID, USER_ID)
    assert result == _NOW


# ── segmentación ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_resolve_lista_custom():
    svc = _make_service()
    uid1 = "00000000-0000-0000-0000-000000000001"
    uid2 = "00000000-0000-0000-0000-000000000002"
    result = await svc._resolve_destinatarios(TENANT_ID, "lista_custom", {"user_ids": [uid1, uid2]})
    assert set(result) == {uid1, uid2}


@pytest.mark.asyncio
async def test_resolve_todos_uses_user_repo():
    svc = _make_service()
    result = await svc._resolve_destinatarios(TENANT_ID, "todos", {})
    assert len(result) == 2
    svc._users.list_users.assert_called_once()
