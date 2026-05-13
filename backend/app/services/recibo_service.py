import hashlib
import io
import math
import re
import uuid
import zipfile
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from supabase._async.client import AsyncClient

from app.repositories.periodo_repository import PeriodoRepository
from app.repositories.recibo_repository import ReciboRepository
from app.repositories.upload_job_repository import UploadJobRepository
from app.repositories.user_repository import UserRepository
from app.repositories.whatsapp_config_repository import WhatsappConfigRepository
from app.schemas.recibos import (
    ConfirmResponse,
    CreatePeriodoRequest,
    FirmaOut,
    FirmarRequest,
    PaginatedDashboard,
    PaginatedPeriodos,
    PaginatedRecibos,
    PeriodoOut,
    PreviewItem,
    ReciboOut,
    ReciboDashboard,
    RenotificarRequest,
    UploadResponse,
)
from app.schemas.users import Pagination

_STORAGE_BUCKET = "recibos"
_SIGNED_URL_TTL = 86400  # 24h
_MAX_FILE_BYTES = 50 * 1024 * 1024  # 50 MB


def _extract_cuil(filename: str) -> str | None:
    digits = re.sub(r"[^0-9]", "", filename)
    match = re.search(r"(\d{11})", digits)
    return match.group(1) if match else None


def _file_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _storage_path(tenant_id: str, periodo_id: str, cuil: str) -> str:
    return f"{tenant_id}/{periodo_id}/{cuil}.pdf"


def _build_pagination(total: int, page: int, page_size: int, base: str) -> Pagination:
    pages = math.ceil(total / page_size) if total > 0 else 1
    nxt = f"{base}?page={page + 1}&page_size={page_size}" if page < pages else None
    prv = f"{base}?page={page - 1}&page_size={page_size}" if page > 1 else None
    return Pagination(total=total, page=page, page_size=page_size, pages=pages, next=nxt, prev=prv)


class ReciboService:
    def __init__(
        self,
        db: AsyncClient,
        periodo_repo: PeriodoRepository,
        recibo_repo: ReciboRepository,
        user_repo: UserRepository,
        wa_config_repo: WhatsappConfigRepository | None = None,
        upload_job_repo: UploadJobRepository | None = None,
    ) -> None:
        self._db = db
        self._periodos = periodo_repo
        self._recibos = recibo_repo
        self._users = user_repo
        self._wa_configs = wa_config_repo
        self._upload_jobs = upload_job_repo or UploadJobRepository(db)

    # ── Períodos ─────────────────────────────────────────────────

    async def list_periodos(
        self, tenant_id: str, *, estado: str | None, page: int, page_size: int
    ) -> PaginatedPeriodos:
        rows, total = await self._periodos.list(tenant_id, estado=estado, page=page, page_size=page_size)
        return PaginatedPeriodos(
            data=[PeriodoOut.from_row(r) for r in rows],
            pagination=_build_pagination(total, page, page_size, "/periodos"),
        )

    async def create_periodo(
        self, tenant_id: str, created_by: str | UUID, data: CreatePeriodoRequest
    ) -> PeriodoOut:
        row = await self._periodos.create(
            tenant_id,
            created_by,
            {
                "periodo": data.periodo,
                "descripcion": data.descripcion,
                "fecha_inicio": data.fecha_inicio,
                "fecha_fin": data.fecha_fin,
                "fecha_limite_firma": data.fecha_limite_firma,
            },
        )
        return PeriodoOut.from_row(row)

    # ── Upload ───────────────────────────────────────────────────

    async def upload_recibos(
        self,
        periodo_id: str,
        tenant_id: str,
        file: UploadFile,
    ) -> UploadResponse:
        periodo = await self._periodos.get(periodo_id, tenant_id)
        if not periodo:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Período no encontrado")
        if periodo["estado"] != "borrador":
            raise HTTPException(status.HTTP_409_CONFLICT, "Solo se pueden subir archivos a períodos en estado borrador")

        raw = await file.read()
        if len(raw) > _MAX_FILE_BYTES:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El archivo excede el límite de 50MB")

        # Extract PDFs from ZIP or use single PDF
        pdfs: list[tuple[str, bytes]] = []  # (filename, bytes)
        fname = file.filename or ""
        if fname.lower().endswith(".zip") or file.content_type == "application/zip":
            try:
                with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                    for name in zf.namelist():
                        if name.lower().endswith(".pdf") and not name.startswith("__MACOSX"):
                            pdfs.append((name.split("/")[-1], zf.read(name)))
            except zipfile.BadZipFile:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El archivo ZIP está dañado")
        elif fname.lower().endswith(".pdf") or file.content_type == "application/pdf":
            pdfs.append((fname, raw))
        else:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El archivo debe ser PDF o ZIP")

        if not pdfs:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El ZIP no contiene archivos PDF")

        job_id = str(uuid.uuid4())

        # Match CUILs to users and upload each PDF to temp storage
        preview: list[PreviewItem] = []
        job_files: list[dict] = []

        for idx, (filename, data_bytes) in enumerate(pdfs):
            cuil = _extract_cuil(filename)
            user = None
            if cuil:
                user = await self._users.get_by_cuil_and_tenant(cuil, tenant_id)

            temp_path = f"temp/{job_id}/{idx:04d}.pdf"
            await self._db.storage.from_(_STORAGE_BUCKET).upload(
                temp_path,
                data_bytes,
                {"content-type": "application/pdf", "upsert": "true"},
            )

            preview.append(PreviewItem(
                cuil=cuil or "desconocido",
                nombre=f"{user['first_name']} {user['last_name']}" if user else None,
                archivo=filename,
                user_id=user["id"] if user else None,
                matched=user is not None,
            ))
            job_files.append({
                "cuil": cuil,
                "filename": filename,
                "temp_path": temp_path,
                "user_id": str(user["id"]) if user else None,
                "size_bytes": len(data_bytes),
            })

        await self._upload_jobs.create(job_id, tenant_id, periodo_id, job_files)

        return UploadResponse(job_id=job_id, total_archivos=len(pdfs), preview=preview)

    async def confirm_upload(
        self, periodo_id: str, tenant_id: str, job_id: str
    ) -> ConfirmResponse:
        job = await self._upload_jobs.get(job_id, tenant_id, periodo_id)
        if not job:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Job no encontrado o expirado")

        periodo = await self._periodos.get(periodo_id, tenant_id)
        if not periodo:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Período no encontrado")

        distribuidos = 0
        errores: list[str] = []
        records: list[dict] = []
        temp_paths: list[str] = []

        for item in job["files"]:
            temp_paths.append(item["temp_path"])

            if not item["user_id"] or not item["cuil"]:
                errores.append(item.get("cuil") or item["filename"])
                continue

            cuil: str = item["cuil"]
            storage_path = _storage_path(tenant_id, periodo_id, cuil)

            try:
                file_bytes: bytes = await self._db.storage.from_(_STORAGE_BUCKET).download(item["temp_path"])
                await self._db.storage.from_(_STORAGE_BUCKET).upload(
                    storage_path,
                    file_bytes,
                    {"content-type": "application/pdf", "upsert": "true"},
                )
            except Exception:
                errores.append(cuil)
                continue

            records.append({
                "tenant_id": tenant_id,
                "periodo_id": periodo_id,
                "user_id": str(item["user_id"]),
                "storage_path": storage_path,
                "archivo_hash": _file_hash(file_bytes),
                "archivo_size_bytes": item["size_bytes"],
                "estado": "pendiente",
            })
            distribuidos += 1

        if records:
            await self._recibos.create_many(records)
            await self._periodos.increment_total_recibos(periodo_id, len(records))
            await self._periodos.update_estado(periodo_id, "distribuido")

        # Clean up temp files and job record
        if temp_paths:
            try:
                await self._db.storage.from_(_STORAGE_BUCKET).remove(temp_paths)
            except Exception:
                pass  # best-effort cleanup
        await self._upload_jobs.delete(job_id)

        return ConfirmResponse(distribuidos=distribuidos, errores=errores)

    # ── Dashboard de período ──────────────────────────────────────

    async def get_periodo_recibos(
        self,
        periodo_id: str,
        tenant_id: str,
        *,
        estado: str | None,
        search: str | None,
        page: int,
        page_size: int,
    ) -> PaginatedDashboard:
        periodo = await self._periodos.get(periodo_id, tenant_id)
        if not periodo:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Período no encontrado")

        rows, total = await self._recibos.list_dashboard(
            periodo_id, tenant_id, estado=estado, search=search, page=page, page_size=page_size
        )

        items: list[ReciboDashboard] = []
        for r in rows:
            u = r.get("users") or {}
            firma = r.get("firmas_electronicas")
            perfil = u.get("colaborador_perfil") or {}
            items.append(ReciboDashboard(
                id=r["id"],
                user_id=r["user_id"],
                nombre=f"{u.get('first_name', '')} {u.get('last_name', '')}".strip(),
                cuil=u.get("cuil"),
                legajo=perfil.get("legajo"),
                estado=r["estado"],
                notificado_at=r.get("notificado_at"),
                visto_at=r.get("visto_at"),
                firmado_at=firma["timestamp_firma"] if firma else None,
            ))

        return PaginatedDashboard(
            data=items,
            pagination=_build_pagination(total, page, page_size, f"/periodos/{periodo_id}/recibos"),
        )

    # ── Recibos del colaborador ───────────────────────────────────

    async def get_my_recibos(
        self,
        user_id: str | UUID,
        *,
        estado: str | None,
        periodo: str | None,
        page: int,
        page_size: int,
    ) -> PaginatedRecibos:
        rows, total = await self._recibos.list_by_user(
            user_id, estado=estado, periodo=periodo, page=page, page_size=page_size
        )
        return PaginatedRecibos(
            data=[self._row_to_recibo(r) for r in rows],
            pagination=_build_pagination(total, page, page_size, "/recibos"),
        )

    async def get_recibo(
        self, recibo_id: str | UUID, current_user: dict
    ) -> ReciboOut:
        row = await self._recibos.get(recibo_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Recibo no encontrado")

        if str(row.get("tenant_id")) != str(current_user.get("tenant_id")):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Recibo no encontrado")

        if current_user["role"] == "colaborador" and str(row["user_id"]) != str(current_user["id"]):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

        # Generate signed URL and mark as seen
        signed_url = await self._get_signed_url(row["storage_path"])
        await self._recibos.set_visto(recibo_id)

        out = self._row_to_recibo(row)
        out.file_url = signed_url
        return out

    async def firmar_recibo(
        self,
        recibo_id: str | UUID,
        current_user: dict,
        data: FirmarRequest,
        request: Request,
    ) -> ReciboOut:
        row = await self._recibos.get(recibo_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Recibo no encontrado")

        if str(row.get("tenant_id")) != str(current_user.get("tenant_id")):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Recibo no encontrado")

        if str(row["user_id"]) != str(current_user["id"]):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo podés firmar tu propio recibo")

        if row["estado"] == "firmado":
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El recibo ya fue firmado")
        if row["estado"] == "vencido":
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El recibo está vencido")

        now = datetime.now(timezone.utc)
        client_ip = request.client.host if request.client else None

        firma_payload: dict = {
            "recibo_id": str(recibo_id),
            "tenant_id": str(row["tenant_id"]),
            "user_id": str(current_user["id"]),
            "canal": data.canal,
            "timestamp_firma": now.isoformat(),
            "archivo_hash": row["archivo_hash"],
        }
        if data.canal == "portal":
            firma_payload["ip_address"] = client_ip
            firma_payload["session_id"] = current_user.get("session_id")

        await self._recibos.create_firma(firma_payload)
        updated = await self._recibos.update_estado(recibo_id, "firmado")
        return self._row_to_recibo(updated)

    # ── Renotificar ───────────────────────────────────────────────

    async def renotificar(
        self, periodo_id: str, tenant_id: str, data: RenotificarRequest
    ) -> dict:
        periodo = await self._periodos.get(periodo_id, tenant_id)
        if not periodo:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Período no encontrado")

        user_ids = [str(uid) for uid in data.user_ids] if data.user_ids else None
        targets = await self._recibos.list_unsigned_user_ids(periodo_id, user_ids)

        if not targets or not self._wa_configs:
            return {"notificados": 0, "sin_wa_config": not bool(self._wa_configs)}

        cfg = await self._wa_configs.get_by_tenant(tenant_id)
        if not cfg or not cfg["is_active"]:
            return {"notificados": 0, "sin_wa_config": True}

        from app.core.config import get_settings
        from app.repositories.whatsapp_log_repository import WhatsappLogRepository
        from app.repositories.whatsapp_session_repository import WhatsappSessionRepository
        from app.services.whatsapp_service import WhatsappService

        settings = get_settings()
        wa_svc = WhatsappService(
            db=self._db,
            settings=settings,
            config_repo=self._wa_configs,
            session_repo=WhatsappSessionRepository(self._db),
            log_repo=WhatsappLogRepository(self._db),
            user_repo=self._users,
            recibo_repo=self._recibos,
        )

        notificados = 0
        for uid in targets:
            user = await self._users.get_by_id(uid)
            if not user or not user.get("whatsapp_id_hash"):
                continue
            recibo = await self._recibos.get_latest_unsigned(uid, tenant_id)
            if not recibo:
                continue
            # wa_id stored hashed — reconstruct is impossible, use masked number as display only
            # Notification requires the raw wa_id; store it encrypted as part of Phase 3 setup
            wa_id = user.get("whatsapp_numero_raw")  # set only when WA integration stores raw
            if not wa_id:
                continue
            nombre = f"{user['first_name']} {user['last_name']}"
            periodo_row = recibo.get("periodos_liquidacion") or {}
            periodo_label = periodo_row.get("descripcion") or periodo_row.get("periodo", "")
            ok = await wa_svc.notify_recibo(
                tenant_id=tenant_id,
                user_id=uid,
                wa_id=wa_id,
                nombre=nombre,
                periodo=periodo_label,
                recibo_id=str(recibo["id"]),
                cfg=cfg,
            )
            if ok:
                notificados += 1

        return {"notificados": notificados}

    # ── Export CSV ────────────────────────────────────────────────

    async def export_csv(
        self, periodo_id: str, tenant_id: str, estado: str | None
    ) -> StreamingResponse:
        periodo = await self._periodos.get(periodo_id, tenant_id)
        if not periodo:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Período no encontrado")

        rows = await self._recibos.list_for_export(periodo_id, tenant_id, estado)

        def _generate():
            yield "legajo,nombre,cuil,periodo,estado,firmado_at,canal\n"
            for r in rows:
                u = r.get("users") or {}
                perfil = u.get("colaborador_perfil") or {}
                firma = r.get("firmas_electronicas")
                p = r.get("periodos_liquidacion") or {}
                yield (
                    f"{perfil.get('legajo', '')},"
                    f"{u.get('first_name', '')} {u.get('last_name', '')},"
                    f"{u.get('cuil', '')},"
                    f"{p.get('periodo', '')},"
                    f"{r.get('estado', '')},"
                    f"{firma['timestamp_firma'] if firma else ''},"
                    f"{firma['canal'] if firma else ''}\n"
                )

        return StreamingResponse(
            _generate(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=recibos_{periodo['periodo']}.csv"},
        )

    # ── Helpers ───────────────────────────────────────────────────

    async def _get_signed_url(self, storage_path: str) -> str | None:
        try:
            res = await self._db.storage.from_(_STORAGE_BUCKET).create_signed_url(
                storage_path, expires_in=_SIGNED_URL_TTL
            )
            return res.get("signedURL") or res.get("signedUrl")
        except Exception:
            return None

    @staticmethod
    def _row_to_recibo(row: dict) -> ReciboOut:
        periodo_data = row.get("periodos_liquidacion") or {}
        firma_data = row.get("firmas_electronicas")
        return ReciboOut(
            id=row["id"],
            periodo=periodo_data.get("periodo") or "",
            descripcion=periodo_data.get("descripcion"),
            estado=row["estado"],
            archivo_hash=row["archivo_hash"],
            fecha_limite_firma=periodo_data.get("fecha_limite_firma"),
            notificado_at=row.get("notificado_at"),
            firma=FirmaOut.model_validate(firma_data) if firma_data else None,
        )
