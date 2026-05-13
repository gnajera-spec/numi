import io
import zipfile
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.recibos import CreatePeriodoRequest, FirmarRequest, RenotificarRequest
from app.services.recibo_service import ReciboService, _extract_cuil


TENANT_ID = "00000000-0000-0000-0000-000000000010"
PERIODO_ID = "00000000-0000-0000-0000-000000000020"
USER_ID = "00000000-0000-0000-0000-000000000001"
RECIBO_ID = "00000000-0000-0000-0000-000000000030"


def _make_periodo(**kwargs) -> dict:
    base = {
        "id": PERIODO_ID,
        "tenant_id": TENANT_ID,
        "periodo": "2026-04",
        "descripcion": "Sueldo Abril 2026",
        "fecha_inicio": "2026-04-01",
        "fecha_fin": "2026-04-30",
        "fecha_limite_firma": None,
        "estado": "borrador",
        "total_recibos": 0,
        "recibos_firmados": 0,
    }
    base.update(kwargs)
    return base


def _make_recibo(**kwargs) -> dict:
    base = {
        "id": RECIBO_ID,
        "tenant_id": TENANT_ID,
        "periodo_id": PERIODO_ID,
        "user_id": USER_ID,
        "storage_path": f"{TENANT_ID}/{PERIODO_ID}/20123456789.pdf",
        "archivo_hash": "abc123",
        "archivo_size_bytes": 1024,
        "estado": "pendiente",
        "notificado_at": None,
        "visto_at": None,
        "periodos_liquidacion": {"periodo": "2026-04", "descripcion": None, "fecha_limite_firma": None},
        "firmas_electronicas": None,
    }
    base.update(kwargs)
    return base


def _make_current_user(**kwargs) -> dict:
    base = {
        "id": USER_ID,
        "role": "colaborador",
        "tenant_id": TENANT_ID,
    }
    base.update(kwargs)
    return base


def _make_svc(db=None, periodo_repo=None, recibo_repo=None, user_repo=None, upload_job_repo=None) -> ReciboService:
    return ReciboService(
        db or AsyncMock(),
        periodo_repo or AsyncMock(),
        recibo_repo or AsyncMock(),
        user_repo or AsyncMock(),
        upload_job_repo=upload_job_repo or AsyncMock(),
    )


# ── _extract_cuil ─────────────────────────────────────────────────────────────

def test_extract_cuil_from_plain_filename():
    assert _extract_cuil("20123456789.pdf") == "20123456789"


def test_extract_cuil_from_formatted_filename():
    assert _extract_cuil("20-12345678-9.pdf") == "20123456789"


def test_extract_cuil_from_compound_filename():
    assert _extract_cuil("recibo_20123456789_Perez.pdf") == "20123456789"


def test_extract_cuil_returns_none_without_11_digits():
    assert _extract_cuil("recibo.pdf") is None


# ── create_periodo ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_periodo_returns_periodo_out():
    periodo_repo = AsyncMock()
    periodo_repo.create.return_value = _make_periodo()
    svc = _make_svc(periodo_repo=periodo_repo)

    result = await svc.create_periodo(
        TENANT_ID,
        USER_ID,
        CreatePeriodoRequest(
            periodo="2026-04",
            fecha_inicio=date(2026, 4, 1),
            fecha_fin=date(2026, 4, 30),
        ),
    )
    assert result.periodo == "2026-04"
    assert result.pct_firmados == 0.0


# ── upload_recibos ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upload_single_pdf_returns_preview():
    from fastapi import UploadFile

    periodo_repo = AsyncMock()
    periodo_repo.get.return_value = _make_periodo()
    user_repo = AsyncMock()
    user_repo.get_by_cuil_and_tenant.return_value = {
        "id": USER_ID, "first_name": "Ana", "last_name": "Lopez"
    }
    upload_job_repo = AsyncMock()

    storage_bucket = MagicMock()
    storage_bucket.upload = AsyncMock()
    db = AsyncMock()
    db.storage.from_ = MagicMock(return_value=storage_bucket)

    pdf_bytes = b"%PDF-1.4 fake pdf content"
    mock_file = MagicMock(spec=UploadFile)
    mock_file.read = AsyncMock(return_value=pdf_bytes)
    mock_file.filename = "20123456789.pdf"
    mock_file.content_type = "application/pdf"

    svc = _make_svc(db=db, periodo_repo=periodo_repo, user_repo=user_repo, upload_job_repo=upload_job_repo)
    result = await svc.upload_recibos(PERIODO_ID, TENANT_ID, mock_file)

    assert result.total_archivos == 1
    assert result.preview[0].cuil == "20123456789"
    assert result.preview[0].matched is True
    upload_job_repo.create.assert_called_once()
    _, call_tenant, call_periodo, call_files = upload_job_repo.create.call_args.args
    assert call_tenant == TENANT_ID
    assert call_periodo == PERIODO_ID
    assert call_files[0]["cuil"] == "20123456789"


@pytest.mark.asyncio
async def test_upload_zip_extracts_pdfs():
    from fastapi import UploadFile

    # Create an in-memory ZIP
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("20123456789.pdf", b"%PDF fake")
        zf.writestr("20987654321.pdf", b"%PDF fake2")
    buf.seek(0)
    zip_bytes = buf.read()

    periodo_repo = AsyncMock()
    periodo_repo.get.return_value = _make_periodo()
    user_repo = AsyncMock()
    user_repo.get_by_cuil_and_tenant.return_value = None
    upload_job_repo = AsyncMock()

    storage_bucket = MagicMock()
    storage_bucket.upload = AsyncMock()
    db = AsyncMock()
    db.storage.from_ = MagicMock(return_value=storage_bucket)

    mock_file = MagicMock(spec=UploadFile)
    mock_file.read = AsyncMock(return_value=zip_bytes)
    mock_file.filename = "recibos.zip"
    mock_file.content_type = "application/zip"

    svc = _make_svc(db=db, periodo_repo=periodo_repo, user_repo=user_repo, upload_job_repo=upload_job_repo)
    result = await svc.upload_recibos(PERIODO_ID, TENANT_ID, mock_file)

    assert result.total_archivos == 2
    assert all(not p.matched for p in result.preview)


@pytest.mark.asyncio
async def test_upload_raises_409_if_periodo_not_borrador():
    from fastapi import HTTPException, UploadFile

    periodo_repo = AsyncMock()
    periodo_repo.get.return_value = _make_periodo(estado="distribuido")

    mock_file = MagicMock(spec=UploadFile)
    mock_file.read = AsyncMock(return_value=b"data")
    mock_file.filename = "f.pdf"
    mock_file.content_type = "application/pdf"

    svc = _make_svc(periodo_repo=periodo_repo)
    with pytest.raises(HTTPException) as exc:
        await svc.upload_recibos(PERIODO_ID, TENANT_ID, mock_file)
    assert exc.value.status_code == 409


# ── firmar_recibo ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_firmar_recibo_creates_firma():
    recibo_repo = AsyncMock()
    recibo_repo.get.return_value = _make_recibo()
    recibo_repo.update_estado.return_value = _make_recibo(
        estado="firmado",
        firmas_electronicas={
            "canal": "portal",
            "timestamp_firma": datetime.now(timezone.utc).isoformat(),
            "archivo_hash": "abc123",
        },
    )

    request = MagicMock()
    request.client.host = "127.0.0.1"

    svc = _make_svc(recibo_repo=recibo_repo)
    result = await svc.firmar_recibo(
        RECIBO_ID,
        _make_current_user(),
        FirmarRequest(canal="portal", conformidad=True),
        request,
    )

    recibo_repo.create_firma.assert_called_once()
    recibo_repo.update_estado.assert_called_once_with(RECIBO_ID, "firmado")
    assert result.estado == "firmado"


@pytest.mark.asyncio
async def test_firmar_recibo_raises_422_if_already_signed():
    from fastapi import HTTPException

    recibo_repo = AsyncMock()
    recibo_repo.get.return_value = _make_recibo(estado="firmado")

    request = MagicMock()
    request.client.host = "127.0.0.1"

    svc = _make_svc(recibo_repo=recibo_repo)
    with pytest.raises(HTTPException) as exc:
        await svc.firmar_recibo(
            RECIBO_ID,
            _make_current_user(),
            FirmarRequest(canal="portal", conformidad=True),
            request,
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_firmar_recibo_raises_403_for_other_users_recibo():
    from fastapi import HTTPException

    recibo_repo = AsyncMock()
    recibo_repo.get.return_value = _make_recibo(user_id="00000000-0000-0000-0000-000000000099")

    request = MagicMock()
    request.client.host = "127.0.0.1"

    svc = _make_svc(recibo_repo=recibo_repo)
    with pytest.raises(HTTPException) as exc:
        await svc.firmar_recibo(
            RECIBO_ID,
            _make_current_user(),
            FirmarRequest(canal="portal", conformidad=True),
            request,
        )
    assert exc.value.status_code == 403


# ── get_recibo ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_recibo_raises_403_for_collaborator_viewing_other():
    from fastapi import HTTPException

    recibo_repo = AsyncMock()
    recibo_repo.get.return_value = _make_recibo(user_id="00000000-0000-0000-0000-000000000099")

    db = AsyncMock()
    db.storage = MagicMock()
    db.storage.from_.return_value = AsyncMock()
    db.storage.from_.return_value.create_signed_url = AsyncMock(return_value={"signedURL": "https://example.com"})

    svc = _make_svc(db=db, recibo_repo=recibo_repo)
    with pytest.raises(HTTPException) as exc:
        await svc.get_recibo(RECIBO_ID, _make_current_user())
    assert exc.value.status_code == 403
