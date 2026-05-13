from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.schemas.tenants import (
    ConvenioCreate,
    DepartamentoCreate,
    DepartamentoUpdate,
    PuestoCreate,
    SedeCreate,
    SedeUpdate,
    TenantBrandingUpdate,
    TenantCreate,
    TenantUpdate,
)
from app.services.tenant_service import TenantService

TENANT_ID  = "00000000-0000-0000-0000-000000000010"
SEDE_ID    = "00000000-0000-0000-0000-000000000020"
DEPTO_ID   = "00000000-0000-0000-0000-000000000030"
PUESTO_ID  = "00000000-0000-0000-0000-000000000040"
_NOW       = "2026-05-13T10:00:00+00:00"


def _tenant_row(**kw):
    return {
        "id": TENANT_ID, "nombre": "Acme SA", "nombre_corto": "Acme",
        "cuit": "30123456789", "subdominio": "acme", "plan": "starter",
        "estado": "activo", "logo_url": None, "color_primario": None,
        "whatsapp_numero": None, "max_colaboradores": 100,
        "created_at": _NOW, "updated_at": _NOW, **kw,
    }


def _sede_row(**kw):
    return {
        "id": SEDE_ID, "tenant_id": TENANT_ID, "nombre": "Casa Central",
        "direccion": None, "ciudad": None, "provincia": None,
        "is_active": True, "created_at": _NOW, "updated_at": _NOW, **kw,
    }


def _depto_row(**kw):
    return {
        "id": DEPTO_ID, "tenant_id": TENANT_ID, "nombre": "Tecnología",
        "padre_id": None, "is_active": True, "created_at": _NOW, "updated_at": _NOW, **kw,
    }


def _puesto_row(**kw):
    return {
        "id": PUESTO_ID, "tenant_id": TENANT_ID, "nombre": "Developer",
        "descripcion": None, "meses_vigencia_aptitud": None,
        "is_active": True, "created_at": _NOW, "updated_at": _NOW, **kw,
    }


def _convenio_row(**kw):
    return {
        "id": "00000000-0000-0000-0000-000000000050", "tenant_id": TENANT_ID,
        "nombre": "SMATA", "descripcion": None, "is_active": True,
        "created_at": _NOW, "updated_at": _NOW, **kw,
    }


def _make_service(**overrides) -> TenantService:
    tenants = AsyncMock()
    tenants.list.return_value = ([_tenant_row()], 1)
    tenants.get.return_value = _tenant_row()
    tenants.get_by_cuit.return_value = None
    tenants.get_by_subdominio.return_value = None
    tenants.create.return_value = _tenant_row()
    tenants.update.return_value = _tenant_row()

    sedes = AsyncMock()
    sedes.list.return_value = ([_sede_row()], 1)
    sedes.get.return_value = _sede_row()
    sedes.get_by_nombre.return_value = None
    sedes.create.return_value = _sede_row()
    sedes.update.return_value = _sede_row()

    deptos = AsyncMock()
    deptos.list.return_value = [_depto_row()]
    deptos.get.return_value = _depto_row()
    deptos.get_by_nombre.return_value = None
    deptos.count_niveles.return_value = 1
    deptos.create.return_value = _depto_row()
    deptos.update.return_value = _depto_row()

    puestos = AsyncMock()
    puestos.list.return_value = ([_puesto_row()], 1)
    puestos.get.return_value = _puesto_row()
    puestos.get_by_nombre.return_value = None
    puestos.create.return_value = _puesto_row()
    puestos.update.return_value = _puesto_row()

    convenios = AsyncMock()
    convenios.list.return_value = [_convenio_row()]
    convenios.get_by_nombre.return_value = None
    convenios.create.return_value = _convenio_row()

    return TenantService(
        tenants=overrides.get("tenants", tenants),
        sedes=overrides.get("sedes", sedes),
        deptos=overrides.get("deptos", deptos),
        puestos=overrides.get("puestos", puestos),
        convenios=overrides.get("convenios", convenios),
    )


# ── Tenants ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_tenants_returns_paginated():
    svc = _make_service()
    result = await svc.list_tenants(None, None, None, 1, 20)
    assert result.total == 1
    assert len(result.items) == 1
    assert result.items[0].nombre == "Acme SA"


@pytest.mark.asyncio
async def test_create_tenant_ok():
    svc = _make_service()
    body = TenantCreate(
        nombre="Acme SA", nombre_corto="Acme", cuit="30123456789",
        subdominio="acme", plan="starter",
        admin_email="admin@acme.com", admin_first_name="Juan", admin_last_name="Pérez",
    )
    result = await svc.create_tenant(body)
    assert result.nombre == "Acme SA"


@pytest.mark.asyncio
async def test_create_tenant_conflict_cuit():
    tenants = AsyncMock()
    tenants.get_by_cuit.return_value = {"id": TENANT_ID}
    svc = _make_service(tenants=tenants)
    body = TenantCreate(
        nombre="Otra SA", nombre_corto="Otra", cuit="30123456789",
        subdominio="otra", plan="starter",
        admin_email="a@b.com", admin_first_name="Ana", admin_last_name="Bo",
    )
    with pytest.raises(HTTPException) as exc:
        await svc.create_tenant(body)
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_create_tenant_conflict_subdominio():
    tenants = AsyncMock()
    tenants.get_by_cuit.return_value = None
    tenants.get_by_subdominio.return_value = {"id": TENANT_ID}
    svc = _make_service(tenants=tenants)
    body = TenantCreate(
        nombre="Otra SA", nombre_corto="Otra", cuit="30999999999",
        subdominio="acme", plan="starter",
        admin_email="a@b.com", admin_first_name="Ana", admin_last_name="Bo",
    )
    with pytest.raises(HTTPException) as exc:
        await svc.create_tenant(body)
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_get_tenant_not_found():
    tenants = AsyncMock()
    tenants.get.return_value = None
    svc = _make_service(tenants=tenants)
    with pytest.raises(HTTPException) as exc:
        await svc.get_tenant(TENANT_ID)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_branding_ok():
    svc = _make_service()
    result = await svc.update_branding(TENANT_ID, TenantBrandingUpdate(color_primario="#FF0000"))
    assert result.id is not None


# ── Sedes ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_sede_ok():
    svc = _make_service()
    result = await svc.create_sede(TENANT_ID, SedeCreate(nombre="Casa Central"))
    assert result.nombre == "Casa Central"


@pytest.mark.asyncio
async def test_create_sede_conflict():
    sedes = AsyncMock()
    sedes.get_by_nombre.return_value = {"id": SEDE_ID}
    svc = _make_service(sedes=sedes)
    with pytest.raises(HTTPException) as exc:
        await svc.create_sede(TENANT_ID, SedeCreate(nombre="Casa Central"))
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_update_sede_not_found():
    sedes = AsyncMock()
    sedes.get.return_value = None
    svc = _make_service(sedes=sedes)
    with pytest.raises(HTTPException) as exc:
        await svc.update_sede(SEDE_ID, TENANT_ID, SedeUpdate(nombre="Nueva"))
    assert exc.value.status_code == 404


# ── Departamentos ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_departamentos_builds_tree():
    svc = _make_service()
    result = await svc.list_departamentos(TENANT_ID, None)
    assert len(result) == 1
    assert result[0].nombre == "Tecnología"


@pytest.mark.asyncio
async def test_create_departamento_ok():
    svc = _make_service()
    result = await svc.create_departamento(TENANT_ID, DepartamentoCreate(nombre="IT"))
    assert result.nombre == "Tecnología"  # mock devuelve el row mockeado


@pytest.mark.asyncio
async def test_create_departamento_max_niveles():
    deptos = AsyncMock()
    deptos.get_by_nombre.return_value = None
    deptos.get.return_value = _depto_row()
    deptos.count_niveles.return_value = 3  # ya está en nivel 3
    deptos.create.return_value = _depto_row()
    svc = _make_service(deptos=deptos)
    from uuid import UUID
    with pytest.raises(HTTPException) as exc:
        await svc.create_departamento(
            TENANT_ID,
            DepartamentoCreate(nombre="Sub-sub-sub", padre_id=UUID(DEPTO_ID)),
        )
    assert exc.value.status_code == 422


# ── Puestos ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_puesto_ok():
    svc = _make_service()
    result = await svc.create_puesto(TENANT_ID, PuestoCreate(nombre="Developer"))
    assert result.nombre == "Developer"


@pytest.mark.asyncio
async def test_create_puesto_conflict():
    puestos = AsyncMock()
    puestos.get_by_nombre.return_value = {"id": PUESTO_ID}
    svc = _make_service(puestos=puestos)
    with pytest.raises(HTTPException) as exc:
        await svc.create_puesto(TENANT_ID, PuestoCreate(nombre="Developer"))
    assert exc.value.status_code == 409


# ── Convenios ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_convenios_ok():
    svc = _make_service()
    result = await svc.list_convenios(TENANT_ID)
    assert len(result) == 1
    assert result[0].nombre == "SMATA"


@pytest.mark.asyncio
async def test_create_convenio_conflict():
    convenios = AsyncMock()
    convenios.get_by_nombre.return_value = {"id": "some-id"}
    svc = _make_service(convenios=convenios)
    with pytest.raises(HTTPException) as exc:
        await svc.create_convenio(TENANT_ID, ConvenioCreate(nombre="SMATA"))
    assert exc.value.status_code == 409
