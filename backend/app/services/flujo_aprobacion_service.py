import logging

from fastapi import HTTPException, status

from app.repositories.aprobacion_solicitud_repository import AprobacionSolicitudRepository
from app.repositories.flujo_aprobacion_repository import FlujoAprobacionRepository
from app.schemas.flujos_aprobacion import (
    FlujoAprobacionCreate,
    FlujoAprobacionOut,
    FlujoAprobacionUpdate,
    PasoFlujoOut,
    TipoLicenciaConFlujoOut,
)

logger = logging.getLogger(__name__)


class FlujoAprobacionService:
    def __init__(
        self,
        flujo_repo: FlujoAprobacionRepository,
        aprobacion_repo: AprobacionSolicitudRepository,
    ) -> None:
        self._flujos = flujo_repo
        self._aprobaciones = aprobacion_repo

    # ── Listado overview ──────────────────────────────────────────────────────

    async def list_tipos_con_flujo(self, tenant_id: str) -> list[TipoLicenciaConFlujoOut]:
        tipos = await self._flujos.list_tipos_licencia(tenant_id)
        flujos = await self._flujos.list_active_flujos(tenant_id)

        # Build index: tipo_licencia_id → active flujo (prefer active, else last)
        flujo_by_tipo: dict[str, dict] = {}
        for f in flujos:
            tid = str(f["tipo_licencia_id"])
            existing = flujo_by_tipo.get(tid)
            if not existing or f["is_active"]:
                flujo_by_tipo[tid] = f

        result = []
        for tipo in tipos:
            tid = str(tipo["id"])
            flujo = flujo_by_tipo.get(tid)
            result.append(TipoLicenciaConFlujoOut(
                tipo_licencia_id=tipo["id"],
                tipo_licencia_nombre=tipo["nombre"],
                tipo_licencia_codigo=tipo["codigo"],
                flujo_id=flujo["id"] if flujo else None,
                flujo_nombre=flujo["nombre"] if flujo else None,
                pasos_count=flujo["pasos_count"] if flujo else 0,
                is_active=flujo["is_active"] if flujo else None,
            ))
        return result

    async def get_departamentos(self, tenant_id: str) -> list[dict]:
        return await self._flujos.get_departamentos_activos(tenant_id)

    # ── CRUD flujo ────────────────────────────────────────────────────────────

    async def get_flujo(self, flujo_id: str, tenant_id: str) -> FlujoAprobacionOut:
        flujo = await self._flujos.get_by_id(flujo_id, tenant_id)
        if not flujo:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Flujo no encontrado")

        pasos = await self._flujos.get_pasos(flujo_id)
        return self._build_out(flujo, pasos)

    async def create_flujo(
        self, tenant_id: str, created_by: str, data: FlujoAprobacionCreate
    ) -> FlujoAprobacionOut:
        tipo_licencia_id = str(data.tipo_licencia_id)

        # Verify no active flujo exists for this tipo
        existing = await self._flujos.get_active_for_tipo(tenant_id, tipo_licencia_id)
        if existing:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Ya existe un flujo activo para este tipo de licencia. Desactivalo primero."
            )

        flujo = await self._flujos.create({
            "tenant_id": tenant_id,
            "tipo_licencia_id": tipo_licencia_id,
            "nombre": data.nombre,
            "descripcion": data.descripcion,
            "is_active": True,
            "created_by": created_by,
        })

        flujo_id = str(flujo["id"])
        pasos_data = self._build_pasos_data(flujo_id, tenant_id, data.pasos)
        for paso_data in pasos_data:
            await self._flujos.create_paso(paso_data)

        pasos = await self._flujos.get_pasos(flujo_id)
        return self._build_out(flujo, pasos)

    async def update_flujo(
        self, flujo_id: str, tenant_id: str, data: FlujoAprobacionUpdate
    ) -> FlujoAprobacionOut:
        flujo = await self._flujos.get_by_id(flujo_id, tenant_id)
        if not flujo:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Flujo no encontrado")

        # Cannot edit if there are active solicitudes using it
        active_count = await self._flujos.count_active_solicitudes(flujo_id)
        if active_count > 0:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"No se puede editar el flujo — hay {active_count} solicitudes en curso. "
                "Desactivalo y creá uno nuevo."
            )

        update_data: dict = {}
        if data.nombre is not None:
            update_data["nombre"] = data.nombre
        if data.descripcion is not None:
            update_data["descripcion"] = data.descripcion

        if update_data:
            flujo = await self._flujos.update(flujo_id, tenant_id, update_data) or flujo

        if data.pasos is not None:
            await self._flujos.delete_pasos(flujo_id)
            pasos_data = self._build_pasos_data(flujo_id, tenant_id, data.pasos)
            for paso_data in pasos_data:
                await self._flujos.create_paso(paso_data)

        pasos = await self._flujos.get_pasos(flujo_id)
        return self._build_out(flujo, pasos)

    async def deactivate_flujo(self, flujo_id: str, tenant_id: str) -> FlujoAprobacionOut:
        flujo = await self._flujos.get_by_id(flujo_id, tenant_id)
        if not flujo:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Flujo no encontrado")

        if not flujo["is_active"]:
            raise HTTPException(status.HTTP_409_CONFLICT, "El flujo ya está inactivo")

        active_count = await self._flujos.count_active_solicitudes(flujo_id)
        updated = await self._flujos.deactivate(flujo_id, tenant_id) or flujo
        pasos = await self._flujos.get_pasos(flujo_id)
        out = self._build_out(updated, pasos)
        if active_count > 0:
            # Attach warning in description for the caller to surface to UI
            logger.info(
                "Flujo %s desactivado con %d solicitudes en curso", flujo_id, active_count
            )
        return out

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _build_pasos_data(flujo_id: str, tenant_id: str, pasos: list) -> list[dict]:
        result = []
        for paso in pasos:
            result.append({
                "flujo_id": flujo_id,
                "tenant_id": tenant_id,
                "orden": paso.orden,
                "nombre": paso.nombre,
                "tipo_aprobador": paso.tipo_aprobador,
                "rol_aprobador": paso.rol_aprobador,
                "departamento_id": str(paso.departamento_id) if paso.departamento_id else None,
                "sla_horas": paso.sla_horas,
                "requiere_comentario": paso.requiere_comentario,
            })
        return result

    @staticmethod
    def _build_out(flujo: dict, pasos: list[dict]) -> FlujoAprobacionOut:
        return FlujoAprobacionOut(
            id=flujo["id"],
            tenant_id=flujo["tenant_id"],
            tipo_licencia_id=flujo["tipo_licencia_id"],
            nombre=flujo["nombre"],
            descripcion=flujo.get("descripcion"),
            is_active=flujo["is_active"],
            created_by=flujo["created_by"],
            created_at=flujo["created_at"],
            updated_at=flujo["updated_at"],
            pasos=[PasoFlujoOut.model_validate(p) for p in pasos],
        )
