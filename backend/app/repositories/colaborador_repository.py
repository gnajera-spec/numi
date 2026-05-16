from datetime import date
from uuid import UUID

from supabase._async.client import AsyncClient


class ColaboradorRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def create(self, user_id: str | UUID, tenant_id: str | UUID, data: dict) -> None:
        payload = {
            "user_id": str(user_id),
            "tenant_id": str(tenant_id),
        }
        for key in (
            "sede_id", "departamento_id", "puesto_id", "convenio_id",
            "legajo", "tipo_contrato",
        ):
            if data.get(key) is not None:
                payload[key] = str(data[key]) if isinstance(data[key], UUID) else data[key]

        if data.get("fecha_ingreso") is not None:
            fi = data["fecha_ingreso"]
            payload["fecha_ingreso"] = fi.isoformat() if isinstance(fi, date) else fi

        await self._db.table("colaborador_perfil").insert(payload).execute()

    async def update(self, user_id: str | UUID, data: dict) -> None:
        payload: dict = {}
        for key in (
            "sede_id", "departamento_id", "puesto_id", "convenio_id",
            "legajo", "tipo_contrato", "email_personal", "telefono_personal",
        ):
            if key in data and data[key] is not None:
                payload[key] = str(data[key]) if isinstance(data[key], UUID) else data[key]

        if "fecha_ingreso" in data and data["fecha_ingreso"] is not None:
            fi = data["fecha_ingreso"]
            payload["fecha_ingreso"] = fi.isoformat() if isinstance(fi, date) else fi

        if not payload:
            return

        await self._db.table("colaborador_perfil").update(payload).eq("user_id", str(user_id)).execute()

    async def get_by_user_id(self, user_id: str | UUID) -> dict | None:
        res = await (
            self._db.table("colaborador_perfil")
            .select("*")
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
        return res.data
