import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from supabase._async.client import AsyncClient

from app.db.supabase import get_supabase
from app.dependencies.auth import get_current_user, require_role
from app.repositories.aprobacion_solicitud_repository import AprobacionSolicitudRepository
from app.repositories.colaborador_repository import ColaboradorRepository
from app.repositories.flujo_aprobacion_repository import FlujoAprobacionRepository
from app.repositories.politica_licencia_repository import PoliticaLicenciaRepository
from app.repositories.saldo_licencia_repository import SaldoLicenciaRepository
from app.repositories.solicitud_licencia_repository import SolicitudLicenciaRepository
from app.repositories.tipo_licencia_repository import TipoLicenciaRepository
from app.repositories.user_repository import UserRepository
from app.repositories.whatsapp_config_repository import WhatsappConfigRepository
from app.schemas.flujos_aprobacion import (
    AprobacionSolicitudOut,
    AprobarPasoRequest,
    DerivarPasoRequest,
    RechazarPasoRequest,
)
from app.schemas.licencias import (
    AprobarSolicitudRequest,
    CalendarioItemOut,
    CreatePoliticaRequest,
    CreateSolicitudRequest,
    CreateTipoLicenciaRequest,
    PaginatedSolicitudes,
    PoliticaLicenciaOut,
    RechazarSolicitudRequest,
    SaldoLicenciaOut,
    SolicitudLicenciaOut,
    TipoLicenciaOut,
    UpdateTipoLicenciaRequest,
)
from app.services.licencia_service import LicenciaService

router = APIRouter(prefix="/licencias", tags=["licencias"])


def _get_service(db: AsyncClient = Depends(get_supabase)) -> LicenciaService:
    return LicenciaService(
        db=db,
        tipo_repo=TipoLicenciaRepository(db),
        politica_repo=PoliticaLicenciaRepository(db),
        solicitud_repo=SolicitudLicenciaRepository(db),
        saldo_repo=SaldoLicenciaRepository(db),
        user_repo=UserRepository(db),
        wa_config_repo=WhatsappConfigRepository(db),
        flujo_repo=FlujoAprobacionRepository(db),
        aprobacion_repo=AprobacionSolicitudRepository(db),
        colaborador_repo=ColaboradorRepository(db),
    )


# ── Calendario ───────────────────────────────────────────────────────────────

@router.get("/calendario", response_model=list[CalendarioItemOut])
async def get_calendario(
    mes: str = Query(..., pattern=r"^\d{4}-\d{2}$", description="YYYY-MM"),
    departamento_id: str | None = Query(None),
    current_user: dict = Depends(require_role("rrhh", "admin_empresa", "super_admin")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.get_calendario(current_user, mes, departamento_id)


# ── Tipos de licencia ─────────────────────────────────────────────────────────

@router.get("/tipos", response_model=list[TipoLicenciaOut])
async def list_tipos(
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.list_tipos(str(current_user["tenant_id"]))


@router.post("/tipos", response_model=TipoLicenciaOut, status_code=201)
async def create_tipo(
    body: CreateTipoLicenciaRequest,
    current_user: dict = Depends(require_role("admin_empresa")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.create_tipo(str(current_user["tenant_id"]), body)


@router.patch("/tipos/{tipo_id}", response_model=TipoLicenciaOut)
async def update_tipo(
    tipo_id: UUID,
    body: UpdateTipoLicenciaRequest,
    current_user: dict = Depends(require_role("admin_empresa")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.update_tipo(str(tipo_id), str(current_user["tenant_id"]), body)


@router.delete("/tipos/{tipo_id}", status_code=204)
async def delete_tipo(
    tipo_id: UUID,
    current_user: dict = Depends(require_role("admin_empresa")),
    svc: LicenciaService = Depends(_get_service),
):
    await svc.delete_tipo(str(tipo_id), str(current_user["tenant_id"]))


# ── Políticas ─────────────────────────────────────────────────────────────────

@router.get("/politicas", response_model=list[PoliticaLicenciaOut])
async def list_politicas(
    current_user: dict = Depends(require_role("rrhh")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.list_politicas(str(current_user["tenant_id"]))


@router.post("/politicas", response_model=PoliticaLicenciaOut, status_code=201)
async def create_politica(
    body: CreatePoliticaRequest,
    current_user: dict = Depends(require_role("admin_empresa")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.create_politica(str(current_user["tenant_id"]), body)


# ── Solicitudes ───────────────────────────────────────────────────────────────

@router.get("/solicitudes-medicas", response_model=PaginatedSolicitudes)
async def list_solicitudes_medicas(
    estado: str | None = Query(None),
    user_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_role("servicio_medico", "rrhh", "admin_empresa", "super_admin")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.list_solicitudes_medicas(
        str(current_user["tenant_id"]),
        estado=estado,
        user_id=str(user_id) if user_id else None,
        page=page,
        page_size=page_size,
    )


@router.get("/solicitudes", response_model=PaginatedSolicitudes)
async def list_solicitudes(
    estado: str | None = Query(None),
    tipo_licencia_id: UUID | None = Query(None),
    user_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_role("rrhh")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.list_solicitudes(
        str(current_user["tenant_id"]),
        estado=estado,
        tipo_licencia_id=str(tipo_licencia_id) if tipo_licencia_id else None,
        user_id=str(user_id) if user_id else None,
        page=page,
        page_size=page_size,
    )


@router.post("/solicitudes", response_model=SolicitudLicenciaOut, status_code=201)
async def create_solicitud(
    body: CreateSolicitudRequest,
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.create_solicitud(current_user, body)


@router.get("/mis-solicitudes", response_model=PaginatedSolicitudes)
async def get_mis_solicitudes(
    estado: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.get_mis_solicitudes(current_user, estado=estado, page=page, page_size=page_size)


@router.get("/saldo", response_model=list[SaldoLicenciaOut])
async def get_saldo(
    anio: int | None = Query(None),
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.get_saldo(current_user, anio)


@router.get("/saldo/{user_id}", response_model=list[SaldoLicenciaOut])
async def get_saldo_user(
    user_id: UUID,
    anio: int | None = Query(None),
    current_user: dict = Depends(require_role("rrhh")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.get_saldo_user(user_id, str(current_user["tenant_id"]), anio)


@router.get("/solicitudes/{solicitud_id}", response_model=SolicitudLicenciaOut)
async def get_solicitud(
    solicitud_id: UUID,
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.get_solicitud(solicitud_id, current_user)


@router.post("/solicitudes/{solicitud_id}/aprobar", response_model=SolicitudLicenciaOut)
async def aprobar_solicitud(
    solicitud_id: UUID,
    body: AprobarSolicitudRequest,
    current_user: dict = Depends(require_role("rrhh")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.aprobar_solicitud(solicitud_id, current_user, body)


@router.post("/solicitudes/{solicitud_id}/rechazar", response_model=SolicitudLicenciaOut)
async def rechazar_solicitud(
    solicitud_id: UUID,
    body: RechazarSolicitudRequest,
    current_user: dict = Depends(require_role("rrhh")),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.rechazar_solicitud(solicitud_id, current_user, body)


@router.post("/solicitudes/{solicitud_id}/cancelar", response_model=SolicitudLicenciaOut)
async def cancelar_solicitud(
    solicitud_id: UUID,
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.cancelar_solicitud(solicitud_id, current_user)


# ── Flujo: paso-based endpoints ───────────────────────────────────────────────

@router.get("/pendientes-mi-aprobacion", response_model=PaginatedSolicitudes)
async def pendientes_mi_aprobacion(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.pendientes_mi_aprobacion(current_user, page=page, page_size=page_size)


@router.post("/solicitudes/{solicitud_id}/aprobar-paso", response_model=SolicitudLicenciaOut)
async def aprobar_paso(
    solicitud_id: UUID,
    body: AprobarPasoRequest,
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.aprobar_paso(solicitud_id, current_user, body)


@router.post("/solicitudes/{solicitud_id}/derivar-paso", response_model=SolicitudLicenciaOut)
async def derivar_paso(
    solicitud_id: UUID,
    body: DerivarPasoRequest,
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.derivar_paso(solicitud_id, current_user, body)


@router.post("/solicitudes/{solicitud_id}/rechazar-paso", response_model=SolicitudLicenciaOut)
async def rechazar_paso(
    solicitud_id: UUID,
    body: RechazarPasoRequest,
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.rechazar_paso(solicitud_id, current_user, body)


@router.get("/solicitudes/{solicitud_id}/historial-aprobacion", response_model=list[AprobacionSolicitudOut])
async def historial_aprobacion(
    solicitud_id: UUID,
    current_user: dict = Depends(get_current_user),
    svc: LicenciaService = Depends(_get_service),
):
    return await svc.get_historial_aprobacion(solicitud_id, current_user)


# ── Documentos adjuntos ───────────────────────────────────────────────────────

@router.post("/solicitudes/{solicitud_id}/documento", status_code=201)
async def add_documento(
    solicitud_id: UUID,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase),
):
    """Adjuntar un documento (certificado médico, etc.) a una solicitud de licencia."""
    ALLOWED = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}
    MAX_SIZE = 10 * 1024 * 1024  # 10 MB

    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=422, detail="Tipo de archivo no permitido. Usar PDF, JPG o PNG.")

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=422, detail="El archivo supera el límite de 10 MB.")

    # Verify solicitud belongs to user (or user is rrhh+)
    sol_res = await db.table("solicitudes_licencia").select("id, user_id, tenant_id").eq("id", str(solicitud_id)).limit(1).execute()
    if not sol_res.data:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    sol = sol_res.data[0]
    role = current_user.get("role", "")
    if role not in ("rrhh", "admin_empresa", "super_admin") and str(sol["user_id"]) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Sin acceso a esta solicitud")

    # Upload to Supabase Storage
    tenant_id = str(sol["tenant_id"])
    ext = (file.filename or "doc").rsplit(".", 1)[-1].lower()
    storage_path = f"{tenant_id}/{solicitud_id}/{uuid.uuid4()}.{ext}"

    try:
        await db.storage.from_("licencias-documentos").upload(
            path=storage_path,
            file=contents,
            file_options={"content-type": file.content_type or "application/octet-stream"},
        )
    except Exception:
        # Bucket puede no existir aún — guardar solo el registro sin storage
        storage_path = None  # type: ignore

    # Insert record in documentos_solicitud
    file_url = ""
    if storage_path:
        try:
            signed = await db.storage.from_("licencias-documentos").create_signed_url(storage_path, 60 * 60 * 24)
            file_url = signed.get("signedURL") or signed.get("signed_url") or ""
        except Exception:
            file_url = ""

    doc_res = await db.table("documentos_solicitud").insert({
        "solicitud_id": str(solicitud_id),
        "filename": file.filename or "documento",
        "storage_path": storage_path or "",
        "file_url": file_url,
        "file_size_bytes": len(contents),
        "mime_type": file.content_type or "application/octet-stream",
        "uploaded_by": str(current_user["id"]),
    }).select("*").execute()

    return doc_res.data[0] if doc_res.data else {"ok": True}
