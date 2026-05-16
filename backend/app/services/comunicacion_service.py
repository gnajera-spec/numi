"""
Comunicacion service: draft creation, segmentation resolution,
WhatsApp dispatch, adjuntos upload, and colaborador-side confirmation.
"""
import logging
import math
from datetime import datetime, timezone

from fastapi import HTTPException, UploadFile, status
from supabase._async.client import AsyncClient

from app.repositories.comunicacion_adjunto_repository import ComunicacionAdjuntoRepository
from app.repositories.comunicacion_destinatario_repository import ComunicacionDestinatarioRepository
from app.repositories.comunicacion_repository import ComunicacionRepository
from app.repositories.user_repository import UserRepository
from app.repositories.whatsapp_config_repository import WhatsappConfigRepository
from app.schemas.comunicaciones import (
    ComunicacionCreate,
    ComunicacionOut,
    ComunicacionSummary,
    EnviarResponse,
    MetricasOut,
    PaginatedComunicaciones,
    PaginatedComunicacionesColaborador,
    ReenviarResponse,
)
from app.services.meta_api import MetaApiClient

logger = logging.getLogger(__name__)

_ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
_MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB


class ComunicacionService:
    def __init__(
        self,
        db: AsyncClient,
        comunicaciones: ComunicacionRepository,
        destinatarios: ComunicacionDestinatarioRepository,
        adjuntos: ComunicacionAdjuntoRepository,
        users: UserRepository,
        wa_config: WhatsappConfigRepository,
    ) -> None:
        self._db = db
        self._comunicaciones = comunicaciones
        self._destinatarios = destinatarios
        self._adjuntos = adjuntos
        self._users = users
        self._wa_config = wa_config

    # ── RRHH: crear borrador ──────────────────────────────────────────────────

    async def create(
        self, tenant_id: str, created_by: str, payload: ComunicacionCreate
    ) -> ComunicacionOut:
        data = payload.model_dump()
        data["tenant_id"] = tenant_id
        data["created_by"] = created_by
        if data.get("programado_at"):
            data["programado_at"] = data["programado_at"].isoformat()
        row = await self._comunicaciones.create(data)
        return ComunicacionOut(**row)

    # ── RRHH: listar ─────────────────────────────────────────────────────────

    async def list_by_tenant(
        self,
        tenant_id: str,
        estado: str | None,
        page: int,
        page_size: int,
    ) -> PaginatedComunicaciones:
        offset = (page - 1) * page_size
        rows, total = await self._comunicaciones.list_by_tenant(tenant_id, estado, offset, page_size)
        pages = max(1, math.ceil(total / page_size))
        return PaginatedComunicaciones(
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
            items=[ComunicacionSummary(**r) for r in rows],
        )

    # ── RRHH: detalle ─────────────────────────────────────────────────────────

    async def get(self, tenant_id: str, comunicacion_id: str) -> ComunicacionOut:
        row = await self._comunicaciones.get(comunicacion_id, tenant_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Comunicación no encontrada")
        metricas_raw = await self._destinatarios.get_metricas(comunicacion_id)
        out = ComunicacionOut(**row)
        out.metricas = MetricasOut(**metricas_raw)
        return out

    # ── RRHH: seguimiento — lista destinatarios ──────────────────────────────

    async def list_destinatarios(self, tenant_id: str, comunicacion_id: str) -> list[dict]:
        com = await self._comunicaciones.get(comunicacion_id, tenant_id)
        if not com:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Comunicación no encontrada")
        rows = await self._destinatarios.list_by_comunicacion(comunicacion_id)
        result = []
        for r in rows:
            u = r.get("users") or {}
            result.append({
                "id": r["id"],
                "user_id": r["user_id"],
                "nombre": f"{u.get('first_name', '')} {u.get('last_name', '')}".strip(),
                "email": u.get("email", ""),
                "estado": r["estado"],
                "leido_at": r.get("leido_at"),
                "confirmado_at": r.get("confirmado_at"),
            })
        return result

    # ── RRHH: adjuntar archivo ────────────────────────────────────────────────

    async def add_adjunto(
        self, tenant_id: str, comunicacion_id: str, file: UploadFile
    ) -> dict:
        com = await self._comunicaciones.get(comunicacion_id, tenant_id)
        if not com:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Comunicación no encontrada")
        if com["estado"] != "borrador":
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Solo se pueden adjuntar archivos a comunicaciones en estado borrador",
            )
        mime = file.content_type or ""
        if mime not in _ALLOWED_MIME:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Tipo de archivo no permitido: {mime}",
            )
        content = await file.read()
        if len(content) > _MAX_FILE_BYTES:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "El archivo supera el límite de 10 MB",
            )
        adjunto = await self._adjuntos.upload_and_create(
            self._db,
            comunicacion_id,
            tenant_id,
            file.filename or "adjunto",
            content,
            mime,
        )
        return adjunto

    # ── RRHH: enviar ──────────────────────────────────────────────────────────

    async def enviar(self, tenant_id: str, comunicacion_id: str) -> EnviarResponse:
        com = await self._comunicaciones.get(comunicacion_id, tenant_id)
        if not com:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Comunicación no encontrada")
        if com["estado"] != "borrador":
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "BIZ_INVALID_STATE", "message": "La comunicación no está en estado borrador"},
            )

        user_ids = await self._resolve_destinatarios(
            tenant_id, com["tipo_segmento"], com["segmento_config"]
        )
        if not user_ids:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "VAL_REQUIRED", "message": "No hay destinatarios en el segmento seleccionado"},
            )

        rows = [{"comunicacion_id": comunicacion_id, "user_id": uid} for uid in user_ids]
        await self._destinatarios.bulk_create(rows)
        await self._comunicaciones.set_enviado(comunicacion_id, tenant_id, len(user_ids))

        await self._dispatch_wa_best_effort(tenant_id, comunicacion_id, com, user_ids)

        await self._comunicaciones.mark_enviado_completo(comunicacion_id, tenant_id)

        return EnviarResponse(estado="enviando", total_destinatarios=len(user_ids))

    # ── RRHH: reenviar a sin confirmación ─────────────────────────────────────

    async def reenviar(self, tenant_id: str, comunicacion_id: str) -> ReenviarResponse:
        com = await self._comunicaciones.get(comunicacion_id, tenant_id)
        if not com:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Comunicación no encontrada")

        pendientes = await self._destinatarios.list_sin_confirmacion(comunicacion_id)
        user_ids = [str(p["user_id"]) for p in pendientes]
        await self._dispatch_wa_best_effort(tenant_id, comunicacion_id, com, user_ids)
        return ReenviarResponse(reenviados=len(user_ids))

    # ── Colaborador: mis comunicaciones ───────────────────────────────────────

    async def list_for_colaborador(
        self,
        user_id: str,
        estado_filter: str | None,
        page: int,
        page_size: int,
    ) -> PaginatedComunicacionesColaborador:
        offset = (page - 1) * page_size
        rows, total = await self._destinatarios.list_by_user(user_id, estado_filter, offset, page_size)
        pages = max(1, math.ceil(total / page_size))

        from app.schemas.comunicaciones import ComunicacionColaboradorItem
        items = [ComunicacionColaboradorItem(**r) for r in rows]
        return PaginatedComunicacionesColaborador(
            total=total, page=page, page_size=page_size, pages=pages, items=items
        )

    # ── Colaborador: marcar como leído ───────────────────────────────────────

    async def marcar_leido(self, comunicacion_id: str, user_id: str) -> str:
        """Mark a communication as read (idempotent — only sets leido_at if not already set)."""
        dest = await self._destinatarios.get_for_user(comunicacion_id, user_id)
        if not dest:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Comunicación no encontrada")
        # Already read — return existing timestamp (idempotent)
        if dest.get("leido_at"):
            return dest["leido_at"]
        await self._destinatarios.mark_leido(comunicacion_id, user_id)
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()

    # ── Colaborador: confirmar lectura ────────────────────────────────────────

    async def confirmar(self, comunicacion_id: str, user_id: str) -> str:
        dest = await self._destinatarios.get_for_user(comunicacion_id, user_id)
        if not dest:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Comunicación no encontrada")

        com = dest.get("comunicaciones", {}) or {}
        if not com.get("requiere_confirmacion"):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "BIZ_INVALID_STATE", "message": "Esta comunicación no requiere confirmación"},
            )
        if dest.get("confirmado_at"):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "BIZ_INVALID_STATE", "message": "Ya confirmaste esta comunicación"},
            )

        confirmed_at = await self._destinatarios.mark_confirmado(comunicacion_id, user_id)
        return confirmed_at

    # ── Internos ──────────────────────────────────────────────────────────────

    async def _resolve_destinatarios(
        self, tenant_id: str, tipo_segmento: str, segmento_config: dict
    ) -> list[str]:
        if tipo_segmento == "lista_custom":
            return [str(uid) for uid in segmento_config.get("user_ids", [])]

        if tipo_segmento == "todos":
            rows, _ = await self._users.list_users(tenant_id, estado="activo", page=1, page_size=10000)
            return [str(r["id"]) for r in rows]

        if tipo_segmento == "sede":
            sede_ids = segmento_config.get("sede_ids", [])
            result = []
            for sede_id in sede_ids:
                rows, _ = await self._users.list_users(
                    tenant_id, estado="activo", sede_id=sede_id, page=1, page_size=10000
                )
                result.extend(str(r["id"]) for r in rows)
            return list(dict.fromkeys(result))

        if tipo_segmento == "departamento":
            dep_ids = segmento_config.get("departamento_ids", [])
            result = []
            for dep_id in dep_ids:
                rows, _ = await self._users.list_users(
                    tenant_id, estado="activo", departamento_id=dep_id, page=1, page_size=10000
                )
                result.extend(str(r["id"]) for r in rows)
            return list(dict.fromkeys(result))

        if tipo_segmento == "puesto":
            puesto_ids = segmento_config.get("puesto_ids", [])
            rows, _ = await self._users.list_users(tenant_id, estado="activo", page=1, page_size=10000)
            return [str(r["id"]) for r in rows if str(r.get("puesto_id", "")) in puesto_ids]

        return []

    async def _dispatch_wa_best_effort(
        self,
        tenant_id: str,
        comunicacion_id: str,
        com: dict,
        user_ids: list[str],
    ) -> None:
        try:
            wa_cfg = await self._wa_config.get_by_tenant(tenant_id)
            if not wa_cfg or not wa_cfg.get("is_active"):
                return
            meta = MetaApiClient(
                phone_number_id=wa_cfg["phone_number_id"],
                access_token=wa_cfg["access_token_encrypted"],
            )
            for uid in user_ids:
                try:
                    user = await self._users.get_by_id(uid)
                    wa_id = user.get("whatsapp_id_hash") if user else None
                    if not wa_id:
                        continue
                    msg = f"📢 *{com['asunto']}*\n\n{com['cuerpo']}"
                    if com.get("requiere_confirmacion"):
                        msg += "\n\nRespondé *LEÍDO* para confirmar la lectura."
                    await meta.send_text(wa_id, msg)
                except Exception:
                    logger.warning("WA send failed for user %s", uid, exc_info=True)
        except Exception:
            logger.warning("WA dispatch failed for comunicacion %s", comunicacion_id, exc_info=True)
