import logging
import math
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from supabase._async.client import AsyncClient

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
    RechazarPasoRequest,
)
from app.schemas.licencias import (
    AprobarSolicitudRequest,
    CreatePoliticaRequest,
    CreateSolicitudRequest,
    CreateTipoLicenciaRequest,
    PaginatedSolicitudes,
    PoliticaLicenciaOut,
    RechazarSolicitudRequest,
    SaldoLicenciaOut,
    SolicitudLicenciaOut,
    TipoLicenciaOut,
)
from app.schemas.users import Pagination
from app.utils.encryption import decrypt

logger = logging.getLogger(__name__)


def _calc_dias_habiles(fecha_inicio: date, fecha_fin: date) -> int:
    days = 0
    current = fecha_inicio
    while current <= fecha_fin:
        if current.weekday() < 5:
            days += 1
        current += timedelta(days=1)
    return max(days, 1)


def _build_pagination(total: int, page: int, page_size: int, base: str) -> Pagination:
    pages = math.ceil(total / page_size) if total > 0 else 1
    nxt = f"{base}?page={page + 1}&page_size={page_size}" if page < pages else None
    prv = f"{base}?page={page - 1}&page_size={page_size}" if page > 1 else None
    return Pagination(total=total, page=page, page_size=page_size, pages=pages, next=nxt, prev=prv)


class LicenciaService:
    def __init__(
        self,
        db: AsyncClient,
        tipo_repo: TipoLicenciaRepository,
        politica_repo: PoliticaLicenciaRepository,
        solicitud_repo: SolicitudLicenciaRepository,
        saldo_repo: SaldoLicenciaRepository,
        user_repo: UserRepository,
        wa_config_repo: WhatsappConfigRepository | None = None,
        flujo_repo: FlujoAprobacionRepository | None = None,
        aprobacion_repo: AprobacionSolicitudRepository | None = None,
        colaborador_repo: ColaboradorRepository | None = None,
    ) -> None:
        self._db = db
        self._tipos = tipo_repo
        self._politicas = politica_repo
        self._solicitudes = solicitud_repo
        self._saldos = saldo_repo
        self._users = user_repo
        self._wa_configs = wa_config_repo
        self._flujos = flujo_repo
        self._aprobaciones = aprobacion_repo
        self._colaboradores = colaborador_repo

    # ── Tipos ─────────────────────────────────────────────────────────────────

    async def list_tipos(self, tenant_id: str) -> list[TipoLicenciaOut]:
        rows = await self._tipos.list(tenant_id)
        return [TipoLicenciaOut.model_validate(r) for r in rows]

    async def create_tipo(self, tenant_id: str, data: CreateTipoLicenciaRequest) -> TipoLicenciaOut:
        payload = {
            "codigo": data.codigo,
            "nombre": data.nombre,
            "descripcion": data.descripcion,
            "requiere_certificado": data.requiere_certificado,
            "dias_maximos": data.dias_maximos,
        }
        row = await self._tipos.create(tenant_id, payload)
        return TipoLicenciaOut.model_validate(row)

    # ── Políticas ─────────────────────────────────────────────────────────────

    async def list_politicas(self, tenant_id: str) -> list[PoliticaLicenciaOut]:
        rows = await self._politicas.list(tenant_id)
        return [PoliticaLicenciaOut.model_validate(r) for r in rows]

    async def create_politica(self, tenant_id: str, data: CreatePoliticaRequest) -> PoliticaLicenciaOut:
        tipo = await self._tipos.get(data.tipo_licencia_id, tenant_id)
        if not tipo:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Tipo de licencia no encontrado")

        row = await self._politicas.create(tenant_id, data.model_dump())
        return PoliticaLicenciaOut.model_validate(row)

    # ── Solicitudes ───────────────────────────────────────────────────────────

    async def list_solicitudes(
        self,
        tenant_id: str,
        *,
        estado: str | None = None,
        tipo_licencia_id: str | None = None,
        user_id: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedSolicitudes:
        rows, total = await self._solicitudes.list_all(
            tenant_id, estado=estado, tipo_licencia_id=tipo_licencia_id, user_id=user_id,
            page=page, page_size=page_size,
        )
        return PaginatedSolicitudes(
            data=[SolicitudLicenciaOut.from_row(r) for r in rows],
            pagination=_build_pagination(total, page, page_size, "/licencias/solicitudes"),
        )

    async def create_solicitud(
        self,
        current_user: dict,
        data: CreateSolicitudRequest,
        canal: str = "portal",
    ) -> SolicitudLicenciaOut:
        tenant_id = str(current_user["tenant_id"])

        # If rrhh+ specifies user_id, use it; otherwise use current user
        if data.user_id and current_user["role"] in ("rrhh", "admin_empresa", "super_admin"):
            target_user_id = str(data.user_id)
        else:
            target_user_id = str(current_user["id"])

        # Validate tipo_licencia exists
        tipo = await self._tipos.get(data.tipo_licencia_id, tenant_id)
        if not tipo:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Tipo de licencia no encontrado")

        # Validate dias_maximos
        dias = _calc_dias_habiles(data.fecha_inicio, data.fecha_fin)
        if tipo.get("dias_maximos") and dias > tipo["dias_maximos"]:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"Los días solicitados ({dias}) superan el máximo permitido ({tipo['dias_maximos']})"
            )

        # Check date overlap with existing active requests
        overlap = await self._solicitudes.has_overlap(
            target_user_id, str(data.fecha_inicio), str(data.fecha_fin)
        )
        if overlap:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Las fechas solicitadas se superponen con otra solicitud activa"
            )

        # Detect active flow for this tipo
        flujo = None
        if self._flujos:
            flujo = await self._flujos.get_active_for_tipo(tenant_id, str(data.tipo_licencia_id))

        solicitud_data: dict = {
            "tenant_id": tenant_id,
            "user_id": target_user_id,
            "tipo_licencia_id": str(data.tipo_licencia_id),
            "fecha_inicio": data.fecha_inicio,
            "fecha_fin": data.fecha_fin,
            "dias_habiles": dias,
            "estado": "pendiente",
            "comentario_empleado": data.comentario,
            "canal": canal,
        }
        if flujo:
            solicitud_data["flujo_id"] = str(flujo["id"])
            solicitud_data["paso_actual"] = 1

        row = await self._solicitudes.create(solicitud_data)

        # Create step tracking snapshot rows if flow exists
        if flujo and self._aprobaciones and self._flujos:
            pasos = await self._flujos.get_pasos(str(flujo["id"]))
            aprobacion_rows = []
            for paso in pasos:
                aprobacion_rows.append({
                    "solicitud_id": str(row["id"]),
                    "tenant_id": tenant_id,
                    "paso_id": str(paso["id"]),
                    "orden": paso["orden"],
                    "nombre_paso": paso["nombre"],
                    "tipo_aprobador": paso["tipo_aprobador"],
                    "rol_aprobador": paso.get("rol_aprobador"),
                    "departamento_id": str(paso["departamento_id"]) if paso.get("departamento_id") else None,
                    "departamento_nombre": paso.get("departamento_nombre"),
                    "estado": "pendiente",
                })
            await self._aprobaciones.create_many(aprobacion_rows)

        # Update saldo: increment dias_pendientes
        anio = data.fecha_inicio.year
        await self._saldos.add_pendientes(
            tenant_id, target_user_id, str(data.tipo_licencia_id), anio, dias
        )

        return SolicitudLicenciaOut.from_row(row)

    async def get_solicitud(self, solicitud_id: str | UUID, current_user: dict) -> SolicitudLicenciaOut:
        row = await self._solicitudes.get(solicitud_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")

        if str(row["tenant_id"]) != str(current_user["tenant_id"]):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")

        if current_user["role"] == "colaborador" and str(row["user_id"]) != str(current_user["id"]):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

        return SolicitudLicenciaOut.from_row(row)

    async def aprobar_solicitud(
        self,
        solicitud_id: str | UUID,
        current_user: dict,
        data: AprobarSolicitudRequest,
    ) -> SolicitudLicenciaOut:
        row = await self._solicitudes.get(solicitud_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")

        if str(row["tenant_id"]) != str(current_user["tenant_id"]):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")

        if row["estado"] not in ("pendiente", "en_revision"):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"No se puede aprobar una solicitud en estado '{row['estado']}'"
            )

        updated = await self._solicitudes.update_estado(
            solicitud_id,
            "aprobada",
            revisado_por=str(current_user["id"]),
            comentario_rrhh=data.comentario,
        )

        # Move dias from pendientes to tomados
        anio = row["fecha_inicio"].year if isinstance(row["fecha_inicio"], date) else int(str(row["fecha_inicio"])[:4])
        await self._saldos.approve(
            str(row["tenant_id"]),
            str(row["user_id"]),
            str(row["tipo_licencia_id"]),
            anio,
            row["dias_habiles"],
        )

        # Notify collaborator via WA (best-effort)
        await self._notify_wa(row, "aprobada", comentario=data.comentario)

        return SolicitudLicenciaOut.from_row(updated)

    async def rechazar_solicitud(
        self,
        solicitud_id: str | UUID,
        current_user: dict,
        data: RechazarSolicitudRequest,
    ) -> SolicitudLicenciaOut:
        row = await self._solicitudes.get(solicitud_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")

        if str(row["tenant_id"]) != str(current_user["tenant_id"]):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")

        if row["estado"] not in ("pendiente", "en_revision"):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"No se puede rechazar una solicitud en estado '{row['estado']}'"
            )

        updated = await self._solicitudes.update_estado(
            solicitud_id,
            "rechazada",
            revisado_por=str(current_user["id"]),
            comentario_rrhh=data.comentario,
        )

        # Return dias_pendientes to available
        anio = row["fecha_inicio"].year if isinstance(row["fecha_inicio"], date) else int(str(row["fecha_inicio"])[:4])
        await self._saldos.subtract_pendientes(
            str(row["tenant_id"]),
            str(row["user_id"]),
            str(row["tipo_licencia_id"]),
            anio,
            row["dias_habiles"],
        )

        await self._notify_wa(row, "rechazada", comentario=data.comentario)

        return SolicitudLicenciaOut.from_row(updated)

    async def cancelar_solicitud(
        self, solicitud_id: str | UUID, current_user: dict
    ) -> SolicitudLicenciaOut:
        row = await self._solicitudes.get(solicitud_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")

        if str(row["tenant_id"]) != str(current_user["tenant_id"]):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")

        if current_user["role"] == "colaborador" and str(row["user_id"]) != str(current_user["id"]):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

        # RN-08: en_revision only admin_empresa can cancel
        if row["estado"] == "en_revision" and current_user["role"] != "admin_empresa":
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Solo el Administrador puede cancelar una solicitud en revisión"
            )
        if row["estado"] not in ("pendiente", "en_revision"):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"No se puede cancelar una solicitud en estado '{row['estado']}'"
            )

        updated = await self._solicitudes.update_estado(solicitud_id, "cancelada")

        # Mark remaining pending steps as omitido
        if self._aprobaciones and row.get("paso_actual"):
            await self._aprobaciones.mark_remaining_omitido(
                str(solicitud_id), row["paso_actual"] - 1
            )

        anio = row["fecha_inicio"].year if isinstance(row["fecha_inicio"], date) else int(str(row["fecha_inicio"])[:4])
        await self._saldos.subtract_pendientes(
            str(row["tenant_id"]),
            str(row["user_id"]),
            str(row["tipo_licencia_id"]),
            anio,
            row["dias_habiles"],
        )

        return SolicitudLicenciaOut.from_row(updated)

    async def get_mis_solicitudes(
        self,
        current_user: dict,
        *,
        estado: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedSolicitudes:
        rows, total = await self._solicitudes.list_by_user(
            current_user["id"],
            str(current_user["tenant_id"]),
            estado=estado,
            page=page,
            page_size=page_size,
        )
        return PaginatedSolicitudes(
            data=[SolicitudLicenciaOut.from_row(r) for r in rows],
            pagination=_build_pagination(total, page, page_size, "/licencias/mis-solicitudes"),
        )

    # ── Saldo ─────────────────────────────────────────────────────────────────

    async def get_saldo(self, current_user: dict, anio: int | None = None) -> list[SaldoLicenciaOut]:
        anio = anio or datetime.now(timezone.utc).year
        rows = await self._saldos.list_for_user(
            str(current_user["tenant_id"]), current_user["id"], anio
        )
        return [SaldoLicenciaOut.from_row(r) for r in rows]

    async def get_saldo_user(
        self, user_id: str | UUID, tenant_id: str, anio: int | None = None
    ) -> list[SaldoLicenciaOut]:
        anio = anio or datetime.now(timezone.utc).year
        rows = await self._saldos.list_for_user(tenant_id, user_id, anio)
        return [SaldoLicenciaOut.from_row(r) for r in rows]

    # ── Flujo: paso-based approval ────────────────────────────────────────────

    async def get_historial_aprobacion(
        self, solicitud_id: str | UUID, current_user: dict
    ) -> list[AprobacionSolicitudOut]:
        if not self._aprobaciones:
            raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Módulo de flujos no disponible")
        row = await self._solicitudes.get(solicitud_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
        if str(row["tenant_id"]) != str(current_user["tenant_id"]):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
        if current_user["role"] not in ("rrhh", "admin_empresa", "super_admin", "servicio_medico"):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")
        pasos = await self._aprobaciones.get_by_solicitud(str(solicitud_id))
        return [AprobacionSolicitudOut.model_validate(p) for p in pasos]

    async def pendientes_mi_aprobacion(
        self, current_user: dict, page: int = 1, page_size: int = 20
    ) -> PaginatedSolicitudes:
        if not self._aprobaciones:
            raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Módulo de flujos no disponible")
        tenant_id = str(current_user["tenant_id"])
        role = current_user["role"]

        if role == "admin_empresa":
            # Admin sees everything pending
            rows, total = await self._solicitudes.list_all(
                tenant_id, estado="pendiente", page=page, page_size=page_size
            )
            # Also en_revision
            rows2, total2 = await self._solicitudes.list_all(
                tenant_id, estado="en_revision", page=1, page_size=page_size
            )
            rows = rows + rows2
            total = total + total2
        elif role in ("rrhh", "servicio_medico"):
            rows, total = await self._aprobaciones.get_pendientes_para_rol(
                tenant_id, role, page, page_size
            )
        elif role == "colaborador":
            if not self._colaboradores:
                return PaginatedSolicitudes(
                    data=[],
                    pagination=_build_pagination(0, page, page_size, "/licencias/pendientes-mi-aprobacion"),
                )
            perfil = await self._colaboradores.get_by_user_id(str(current_user["id"]))
            if not perfil or not perfil.get("departamento_id"):
                return PaginatedSolicitudes(
                    data=[],
                    pagination=_build_pagination(0, page, page_size, "/licencias/pendientes-mi-aprobacion"),
                )
            rows, total = await self._aprobaciones.get_pendientes_para_departamento(
                tenant_id,
                str(perfil["departamento_id"]),
                str(current_user["id"]),
                page,
                page_size,
            )
        else:
            rows, total = [], 0

        return PaginatedSolicitudes(
            data=[SolicitudLicenciaOut.from_row(r) for r in rows],
            pagination=_build_pagination(total, page, page_size, "/licencias/pendientes-mi-aprobacion"),
        )

    async def aprobar_paso(
        self,
        solicitud_id: str | UUID,
        current_user: dict,
        data: AprobarPasoRequest,
    ) -> SolicitudLicenciaOut:
        if not self._aprobaciones or not self._flujos:
            raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Módulo de flujos no disponible")

        row = await self._solicitudes.get(solicitud_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
        if str(row["tenant_id"]) != str(current_user["tenant_id"]):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
        if row["estado"] not in ("pendiente", "en_revision"):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"La solicitud no está en estado procesable (estado: {row['estado']})"
            )
        if not row.get("flujo_id"):
            # Fallback: use legacy single-step approval
            return await self.aprobar_solicitud(solicitud_id, current_user, AprobarSolicitudRequest(comentario=data.comentario))

        paso_actual_num = row["paso_actual"]
        aprobacion = await self._aprobaciones.get_current_paso(str(solicitud_id), paso_actual_num)
        if not aprobacion:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Paso de aprobación no encontrado")
        if aprobacion["estado"] != "pendiente":
            raise HTTPException(status.HTTP_409_CONFLICT, "Este paso ya fue resuelto")

        # Authorization check
        await self._check_paso_authorization(aprobacion, current_user, row)

        # Validate comentario if required
        paso_def = await self._flujos.get_pasos(str(row["flujo_id"]))
        paso_config = next((p for p in paso_def if p["orden"] == paso_actual_num), None)
        if paso_config and paso_config["requiere_comentario"] and not data.comentario:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Este paso requiere un comentario al aprobar"
            )

        # Mark step as approved
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        await self._aprobaciones.update_paso(str(aprobacion["id"]), {
            "estado": "aprobado",
            "aprobado_por": str(current_user["id"]),
            "comentario": data.comentario,
            "fecha_decision": now.isoformat(),
        })

        # Count total steps for this flow
        total_pasos = len(paso_def)
        is_last = paso_actual_num >= total_pasos

        if is_last:
            # Final approval
            updated = await self._solicitudes.update_estado(
                solicitud_id, "aprobada",
                revisado_por=str(current_user["id"]),
                comentario_rrhh=data.comentario,
            )
            anio = row["fecha_inicio"].year if isinstance(row["fecha_inicio"], date) else int(str(row["fecha_inicio"])[:4])
            await self._saldos.approve(
                str(row["tenant_id"]), str(row["user_id"]),
                str(row["tipo_licencia_id"]), anio, row["dias_habiles"],
            )
            await self._notify_wa(row, "aprobada", comentario=data.comentario)
        else:
            # Advance to next step
            next_paso = paso_actual_num + 1
            updated = await self._solicitudes.update({
                "id": str(solicitud_id),
                "estado": "en_revision",
                "paso_actual": next_paso,
            })

        return SolicitudLicenciaOut.from_row(updated)

    async def rechazar_paso(
        self,
        solicitud_id: str | UUID,
        current_user: dict,
        data: RechazarPasoRequest,
    ) -> SolicitudLicenciaOut:
        if not self._aprobaciones or not self._flujos:
            raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Módulo de flujos no disponible")

        row = await self._solicitudes.get(solicitud_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
        if str(row["tenant_id"]) != str(current_user["tenant_id"]):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
        if row["estado"] not in ("pendiente", "en_revision"):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"La solicitud no está en estado procesable (estado: {row['estado']})"
            )
        if not row.get("flujo_id"):
            return await self.rechazar_solicitud(solicitud_id, current_user, RechazarSolicitudRequest(comentario=data.comentario))

        paso_actual_num = row["paso_actual"]
        aprobacion = await self._aprobaciones.get_current_paso(str(solicitud_id), paso_actual_num)
        if not aprobacion:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Paso de aprobación no encontrado")
        if aprobacion["estado"] != "pendiente":
            raise HTTPException(status.HTTP_409_CONFLICT, "Este paso ya fue resuelto")

        await self._check_paso_authorization(aprobacion, current_user, row)

        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        await self._aprobaciones.update_paso(str(aprobacion["id"]), {
            "estado": "rechazado",
            "aprobado_por": str(current_user["id"]),
            "comentario": data.comentario,
            "fecha_decision": now.isoformat(),
        })
        # Mark remaining steps as omitido
        await self._aprobaciones.mark_remaining_omitido(str(solicitud_id), paso_actual_num)

        updated = await self._solicitudes.update_estado(
            solicitud_id, "rechazada",
            revisado_por=str(current_user["id"]),
            comentario_rrhh=data.comentario,
        )

        anio = row["fecha_inicio"].year if isinstance(row["fecha_inicio"], date) else int(str(row["fecha_inicio"])[:4])
        await self._saldos.subtract_pendientes(
            str(row["tenant_id"]), str(row["user_id"]),
            str(row["tipo_licencia_id"]), anio, row["dias_habiles"],
        )
        await self._notify_wa(row, "rechazada", comentario=data.comentario)

        return SolicitudLicenciaOut.from_row(updated)

    async def _check_paso_authorization(
        self, aprobacion: dict, current_user: dict, solicitud: dict
    ) -> None:
        """Raises 403 if the user is not authorized to act on this step."""
        role = current_user["role"]

        # admin_empresa can act on any step
        if role == "admin_empresa":
            return

        tipo = aprobacion["tipo_aprobador"]

        if tipo == "rol":
            if role != aprobacion.get("rol_aprobador"):
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    f"Solo el rol '{aprobacion['rol_aprobador']}' puede actuar en este paso"
                )
        elif tipo == "departamento":
            if role != "colaborador":
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "Solo colaboradores del departamento aprobador pueden actuar en este paso"
                )
            # RN-06: cannot approve own request
            if str(current_user["id"]) == str(solicitud["user_id"]):
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "No podés aprobar tu propia solicitud"
                )
            if not self._colaboradores:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")
            perfil = await self._colaboradores.get_by_user_id(str(current_user["id"]))
            if not perfil or str(perfil.get("departamento_id", "")) != str(aprobacion.get("departamento_id", "")):
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "No pertenecés al departamento aprobador de este paso"
                )

    # ── WA notifications ─────────────────────────────────────────────────────

    async def _notify_wa(self, solicitud: dict, resultado: str, comentario: str | None = None) -> None:
        """Send WA notification to collaborator. Best-effort — never raises."""
        if not self._wa_configs:
            return
        try:
            tenant_id = str(solicitud["tenant_id"])
            user_id = str(solicitud["user_id"])

            user = await self._users.get_by_id(user_id)
            if not user or not user.get("whatsapp_id_encrypted"):
                return

            cfg = await self._wa_configs.get_by_tenant(tenant_id)
            if not cfg or not cfg.get("is_active"):
                return

            from app.core.config import get_settings
            from app.services.meta_api import MetaApiClient

            settings = get_settings()
            if not settings.encryption_key:
                return

            wa_id = decrypt(user["whatsapp_id_encrypted"], settings.encryption_key)
            access_token = decrypt(cfg["access_token_encrypted"], settings.encryption_key)
            client = MetaApiClient(cfg["phone_number_id"], access_token)

            nombre = f"{user['first_name']} {user['last_name']}"
            fecha_inicio = str(solicitud["fecha_inicio"])
            fecha_fin = str(solicitud["fecha_fin"])

            if resultado == "aprobada":
                components = [{"type": "body", "parameters": [
                    {"type": "text", "text": nombre},
                    {"type": "text", "text": fecha_inicio},
                    {"type": "text", "text": fecha_fin},
                ]}]
                await client.send_template(wa_id, "licencia_aprobada", components)
            elif resultado == "rechazada":
                motivo = comentario or "Sin motivo especificado"
                components = [{"type": "body", "parameters": [
                    {"type": "text", "text": nombre},
                    {"type": "text", "text": fecha_inicio},
                    {"type": "text", "text": fecha_fin},
                    {"type": "text", "text": motivo},
                ]}]
                await client.send_template(wa_id, "licencia_rechazada", components)

        except httpx.HTTPStatusError as exc:
            logger.error("Meta API error notifying licencia result: %s", exc)
        except Exception as exc:
            logger.error("Error notifying licencia result: %s", exc)
