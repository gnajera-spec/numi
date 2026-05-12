"""
Medico service: fichas médicas (AES-256), exámenes, vacunaciones,
aptitudes laborales, accidentes de trabajo y reportes.
Acceso exclusivo: servicio_medico, admin_empresa, super_admin.
"""
import json
import logging
import math
from datetime import date, timedelta

from fastapi import HTTPException, UploadFile, status
from supabase._async.client import AsyncClient

from app.core.config import Settings
from app.repositories.accidente_trabajo_repository import AccidenteTrabajoRepository
from app.repositories.aptitud_laboral_repository import AptitudLaboralRepository
from app.repositories.examen_medico_repository import ExamenMedicoRepository
from app.repositories.ficha_medica_repository import FichaMedicaRepository
from app.repositories.vacunacion_repository import VacunacionRepository
from app.schemas.medico import (
    AccidenteCreate,
    AccidenteOut,
    AccidenteUpdate,
    AptitudCreate,
    AptitudOut,
    AptitudPorVencerItem,
    ExamenCreate,
    ExamenOut,
    FichaMedicaOut,
    FichaMedicaSummary,
    FichaMedicaUpdate,
    PaginatedAccidentes,
    PaginatedFichas,
    ReporteAbsentismo,
    VacunacionCreate,
    VacunacionOut,
)
from app.utils.encryption import decrypt, encrypt

logger = logging.getLogger(__name__)

_ALLOWED_MIME_EXAMEN = {"application/pdf", "image/jpeg", "image/png"}
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
_SIGNED_URL_EXPIRY = 6 * 3600   # 6 horas (más restrictivo que recibos)


class MedicoService:
    def __init__(
        self,
        db: AsyncClient,
        settings: Settings,
        fichas: FichaMedicaRepository,
        examenes: ExamenMedicoRepository,
        vacunaciones: VacunacionRepository,
        aptitudes: AptitudLaboralRepository,
        accidentes: AccidenteTrabajoRepository,
    ) -> None:
        self._db = db
        self._settings = settings
        self._fichas = fichas
        self._examenes = examenes
        self._vacunaciones = vacunaciones
        self._aptitudes = aptitudes
        self._accidentes = accidentes

    # ── helpers de encriptación ───────────────────────────────────────────────

    def _enc(self, value: list | None) -> str | None:
        if value is None:
            return None
        return encrypt(json.dumps(value), self._settings.encryption_key)

    def _dec(self, ciphertext: str | None) -> list | None:
        if not ciphertext:
            return None
        try:
            return json.loads(decrypt(ciphertext, self._settings.encryption_key))
        except Exception:
            logger.error("Error desencriptando campo médico")
            return None

    def _row_to_ficha_out(self, row: dict) -> FichaMedicaOut:
        return FichaMedicaOut(
            id=row["id"],
            tenant_id=row["tenant_id"],
            user_id=row["user_id"],
            grupo_sanguineo=row.get("grupo_sanguineo"),
            factor_rh=row.get("factor_rh"),
            alergias=self._dec(row.get("alergias_encrypted")),
            condiciones=self._dec(row.get("condiciones_encrypted")),
            observaciones=row.get("observaciones"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    # ── Fichas médicas ────────────────────────────────────────────────────────

    async def list_fichas(
        self,
        tenant_id: str,
        sede_id: str | None,
        departamento_id: str | None,
        search: str | None,
        page: int,
        page_size: int,
    ) -> PaginatedFichas:
        offset = (page - 1) * page_size
        rows, total = await self._fichas.list_with_users(
            tenant_id, sede_id, departamento_id, search, offset, page_size
        )
        items = []
        for row in rows:
            ficha = (row.get("fichas_medicas") or [None])[0]
            items.append(
                FichaMedicaSummary(
                    user_id=row["id"],
                    nombre_completo=f"{row['nombre']} {row['apellido']}",
                    email=row["email"],
                    grupo_sanguineo=ficha["grupo_sanguineo"] if ficha else None,
                    tiene_ficha=ficha is not None,
                )
            )
        pages = math.ceil(total / page_size) if total else 1
        return PaginatedFichas(total=total, page=page, page_size=page_size, pages=pages, items=items)

    async def get_ficha(self, user_id: str, tenant_id: str) -> FichaMedicaOut:
        row = await self._fichas.get(user_id, tenant_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Ficha médica no encontrada")
        return self._row_to_ficha_out(row)

    async def upsert_ficha(
        self, user_id: str, tenant_id: str, body: FichaMedicaUpdate
    ) -> FichaMedicaOut:
        payload: dict = {}
        if body.grupo_sanguineo is not None:
            payload["grupo_sanguineo"] = body.grupo_sanguineo
        if body.factor_rh is not None:
            payload["factor_rh"] = body.factor_rh
        if body.alergias is not None:
            payload["alergias_encrypted"] = self._enc(body.alergias)
        if body.condiciones is not None:
            payload["condiciones_encrypted"] = self._enc(body.condiciones)
        if body.observaciones is not None:
            payload["observaciones"] = body.observaciones

        row = await self._fichas.upsert(user_id, tenant_id, payload)
        return self._row_to_ficha_out(row)

    # ── Exámenes médicos ──────────────────────────────────────────────────────

    async def list_examenes(self, user_id: str, tenant_id: str) -> list[ExamenOut]:
        rows = await self._examenes.list_by_user(user_id, tenant_id)
        return [
            ExamenOut(
                id=r["id"],
                tenant_id=r["tenant_id"],
                user_id=r["user_id"],
                tipo=r["tipo"],
                fecha=r["fecha"],
                resultado=self._dec_str(r.get("resultado")),
                medico_responsable=r.get("medico_responsable"),
                storage_path=r.get("storage_path"),
                created_by=r["created_by"],
                created_at=r["created_at"],
            )
            for r in rows
        ]

    def _dec_str(self, ciphertext: str | None) -> str | None:
        if not ciphertext:
            return None
        try:
            return decrypt(ciphertext, self._settings.encryption_key)
        except Exception:
            logger.error("Error desencriptando resultado de examen")
            return None

    async def create_examen(
        self,
        user_id: str,
        tenant_id: str,
        created_by: str,
        body: ExamenCreate,
        archivo: UploadFile | None,
    ) -> ExamenOut:
        resultado_enc = None
        if body.resultado:
            resultado_enc = encrypt(body.resultado, self._settings.encryption_key)

        data = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "tipo": body.tipo,
            "fecha": body.fecha.isoformat(),
            "resultado": resultado_enc,
            "medico_responsable": body.medico_responsable,
            "created_by": created_by,
        }
        row = await self._examenes.create(data)

        if archivo:
            storage_path = await self._upload_examen(tenant_id, str(row["id"]), archivo)
            await self._examenes.update_storage_path(str(row["id"]), storage_path)
            row["storage_path"] = storage_path

        return ExamenOut(
            id=row["id"],
            tenant_id=row["tenant_id"],
            user_id=row["user_id"],
            tipo=row["tipo"],
            fecha=row["fecha"],
            resultado=body.resultado,
            medico_responsable=row.get("medico_responsable"),
            storage_path=row.get("storage_path"),
            created_by=row["created_by"],
            created_at=row["created_at"],
        )

    async def _upload_examen(
        self, tenant_id: str, exam_id: str, archivo: UploadFile
    ) -> str:
        if archivo.content_type not in _ALLOWED_MIME_EXAMEN:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Tipo de archivo no permitido")
        content = await archivo.read()
        if len(content) > _MAX_BYTES:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Archivo demasiado grande (máx 10 MB)")
        path = f"{tenant_id}/examenes/{exam_id}/{archivo.filename}"
        await self._db.storage.from_("documentos-medicos").upload(
            path, content, {"content-type": archivo.content_type}
        )
        return path

    # ── Vacunaciones ──────────────────────────────────────────────────────────

    async def list_vacunaciones(self, user_id: str, tenant_id: str) -> list[VacunacionOut]:
        rows = await self._vacunaciones.list_by_user(user_id, tenant_id)
        return [VacunacionOut(**r) for r in rows]

    async def create_vacunacion(
        self,
        user_id: str,
        tenant_id: str,
        created_by: str,
        body: VacunacionCreate,
    ) -> VacunacionOut:
        data = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "vacuna": body.vacuna,
            "fecha": body.fecha.isoformat(),
            "lote": body.lote,
            "proxima_dosis": body.proxima_dosis.isoformat() if body.proxima_dosis else None,
            "created_by": created_by,
        }
        row = await self._vacunaciones.create(data)
        return VacunacionOut(**row)

    # ── Aptitudes laborales ───────────────────────────────────────────────────

    async def list_aptitudes(self, user_id: str, tenant_id: str) -> list[AptitudOut]:
        rows = await self._aptitudes.list_by_user(user_id, tenant_id)
        return [AptitudOut(**r) for r in rows]

    async def create_aptitud(
        self,
        user_id: str,
        tenant_id: str,
        emitido_por: str,
        body: AptitudCreate,
    ) -> AptitudOut:
        data = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "puesto_id": str(body.puesto_id),
            "estado": body.estado,
            "restricciones": body.restricciones,
            "fecha_emision": body.fecha_emision.isoformat(),
            "fecha_vencimiento": body.fecha_vencimiento.isoformat() if body.fecha_vencimiento else None,
            "emitido_por": emitido_por,
        }
        row = await self._aptitudes.create(data)
        return AptitudOut(**row)

    # ── Accidentes de trabajo ─────────────────────────────────────────────────

    async def list_accidentes(
        self,
        tenant_id: str,
        estado: str | None,
        user_id: str | None,
        desde: str | None,
        hasta: str | None,
        page: int,
        page_size: int,
    ) -> PaginatedAccidentes:
        offset = (page - 1) * page_size
        rows, total = await self._accidentes.list_by_tenant(
            tenant_id, estado, user_id, desde, hasta, offset, page_size
        )
        pages = math.ceil(total / page_size) if total else 1
        items = [AccidenteOut(**r) for r in rows]
        return PaginatedAccidentes(total=total, page=page, page_size=page_size, pages=pages, items=items)

    async def create_accidente(
        self,
        tenant_id: str,
        created_by: str,
        body: AccidenteCreate,
    ) -> AccidenteOut:
        data = {
            "tenant_id": tenant_id,
            "user_id": str(body.user_id),
            "fecha_hora": body.fecha_hora.isoformat(),
            "lugar": body.lugar,
            "descripcion": body.descripcion,
            "testigos": [t.model_dump() for t in body.testigos] if body.testigos else None,
            "estado": "abierto",
            "created_by": created_by,
        }
        row = await self._accidentes.create(data)
        return AccidenteOut(**row)

    async def update_accidente(
        self,
        accidente_id: str,
        tenant_id: str,
        body: AccidenteUpdate,
    ) -> AccidenteOut:
        row = await self._accidentes.get(accidente_id, tenant_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Accidente no encontrado")

        payload: dict = {}
        if body.estado is not None:
            payload["estado"] = body.estado
        if body.numero_art is not None:
            payload["numero_art"] = body.numero_art

        if not payload:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Sin campos para actualizar")

        updated = await self._accidentes.update(accidente_id, tenant_id, payload)
        return AccidenteOut(**updated)

    # ── Reportes ──────────────────────────────────────────────────────────────

    async def reporte_absentismo(
        self,
        tenant_id: str,
        desde: date,
        hasta: date,
        departamento_id: str | None,
    ) -> ReporteAbsentismo:
        q = (
            self._db.table("solicitudes_licencia")
            .select(
                "fecha_inicio, fecha_fin, "
                "colaborador:users!user_id(departamentos:colaborador_perfil(departamento_id, departamentos!departamento_id(nombre)))"
            )
            .eq("tenant_id", tenant_id)
            .eq("estado", "aprobada")
            .in_("tipo_licencia_id", await self._get_tipo_ids_enfermedad(tenant_id))
            .lte("fecha_inicio", hasta.isoformat())
            .gte("fecha_fin", desde.isoformat())
        )
        if departamento_id:
            q = q.eq("colaborador.colaborador_perfil.departamento_id", departamento_id)
        res = await q.execute()
        rows = res.data or []

        dept_map: dict[str, dict] = {}
        total_dias = 0
        for r in rows:
            try:
                fi = date.fromisoformat(r["fecha_inicio"])
                ff = date.fromisoformat(r["fecha_fin"])
                dias = (min(ff, hasta) - max(fi, desde)).days + 1
                if dias <= 0:
                    continue
                nombre_dept = "Sin departamento"
                try:
                    nombre_dept = (
                        r["colaborador"]["departamentos"]["departamentos"]["nombre"]
                    )
                except (KeyError, TypeError):
                    pass
                if nombre_dept not in dept_map:
                    dept_map[nombre_dept] = {"dias": 0, "ids": set()}
                dept_map[nombre_dept]["dias"] += dias
                dept_map[nombre_dept]["ids"].add(r.get("user_id", ""))
                total_dias += dias
            except Exception:
                continue

        periodo_dias = (hasta - desde).days + 1 or 1
        total_colaboradores = sum(len(v["ids"]) for v in dept_map.values())
        tasa_global = round(total_dias / (total_colaboradores * periodo_dias) * 100, 2) if total_colaboradores else 0.0

        por_dept = []
        for nombre, v in dept_map.items():
            colab = len(v["ids"])
            tasa = round(v["dias"] / (colab * periodo_dias) * 100, 2) if colab else 0.0
            por_dept.append({
                "departamento": nombre,
                "dias_ausentes": v["dias"],
                "colaboradores": colab,
                "tasa_pct": tasa,
            })

        return ReporteAbsentismo(
            periodo={"desde": desde.isoformat(), "hasta": hasta.isoformat()},
            por_departamento=por_dept,
            total_dias_ausentes=total_dias,
            tasa_global_pct=tasa_global,
        )

    async def _get_tipo_ids_enfermedad(self, tenant_id: str) -> list[str]:
        res = await (
            self._db.table("tipos_licencia")
            .select("id")
            .eq("codigo", "ENF")
            .execute()
        )
        return [r["id"] for r in (res.data or [])]

    async def reporte_aptitudes_por_vencer(
        self,
        tenant_id: str,
        dias: int,
        sede_id: str | None,
        departamento_id: str | None,
    ) -> list[AptitudPorVencerItem]:
        rows = await self._aptitudes.list_por_vencer(tenant_id, dias, sede_id, departamento_id)
        hoy = date.today()
        items = []
        for r in rows:
            venc = date.fromisoformat(r["fecha_vencimiento"])
            dias_rest = (venc - hoy).days
            try:
                nombre = f"{r['users']['nombre']} {r['users']['apellido']}"
                puesto = r["puestos"]["nombre"]
            except (KeyError, TypeError):
                nombre = str(r["user_id"])
                puesto = str(r["puesto_id"])
            items.append(
                AptitudPorVencerItem(
                    user_id=r["user_id"],
                    nombre_completo=nombre,
                    puesto=puesto,
                    estado=r["estado"],
                    fecha_vencimiento=venc,
                    dias_restantes=dias_rest,
                )
            )
        return items
