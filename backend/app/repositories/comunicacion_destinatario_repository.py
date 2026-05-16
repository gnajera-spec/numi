from datetime import datetime, timezone

from supabase._async.client import AsyncClient


class ComunicacionDestinatarioRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def bulk_create(self, rows: list[dict]) -> int:
        if not rows:
            return 0
        # Use upsert with ignore_duplicates=True so re-sending doesn't fail
        # on the UNIQUE (comunicacion_id, user_id) constraint
        res = await (
            self._db.table("comunicacion_destinatarios")
            .upsert(rows, on_conflict="comunicacion_id,user_id", ignore_duplicates=True)
            .execute()
        )
        return len(res.data or [])

    async def list_by_comunicacion(self, comunicacion_id: str) -> list[dict]:
        res = await (
            self._db.table("comunicacion_destinatarios")
            .select("*, users(id, first_name, last_name, email)")
            .eq("comunicacion_id", comunicacion_id)
            .execute()
        )
        return res.data or []

    async def list_by_user(
        self,
        user_id: str,
        estado_filter: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[dict], int]:
        q = (
            self._db.table("comunicacion_destinatarios")
            .select(
                "id, estado, enviado_at, leido_at, confirmado_at, "
                "comunicaciones(id, asunto, cuerpo, requiere_confirmacion, enviado_at, "
                "comunicacion_adjuntos(id, filename, file_url, file_size_bytes, mime_type))",
                count="exact",
            )
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if estado_filter and estado_filter != "todas":
            if estado_filter == "no_leidas":
                q = q.is_("leido_at", "null")
            elif estado_filter == "confirmadas":
                q = q.eq("estado", "confirmado")
        res = await q.execute()
        return res.data or [], res.count or 0

    async def get_for_user(self, comunicacion_id: str, user_id: str) -> dict | None:
        res = await (
            self._db.table("comunicacion_destinatarios")
            .select("*, comunicaciones(id, asunto, cuerpo, requiere_confirmacion, comunicacion_adjuntos(id, filename, file_url, file_size_bytes, mime_type))")
            .eq("comunicacion_id", comunicacion_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return res.data

    async def mark_leido(self, comunicacion_id: str, user_id: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await (
            self._db.table("comunicacion_destinatarios")
            .update({"leido_at": now, "estado": "leido"})
            .eq("comunicacion_id", comunicacion_id)
            .eq("user_id", user_id)
            .is_("leido_at", "null")
            .execute()
        )

    async def mark_confirmado(self, comunicacion_id: str, user_id: str) -> str:
        now = datetime.now(timezone.utc).isoformat()
        await (
            self._db.table("comunicacion_destinatarios")
            .update({"confirmado_at": now, "estado": "confirmado", "leido_at": now})
            .eq("comunicacion_id", comunicacion_id)
            .eq("user_id", user_id)
            .execute()
        )
        return now

    async def list_sin_confirmacion(self, comunicacion_id: str) -> list[dict]:
        res = await (
            self._db.table("comunicacion_destinatarios")
            .select("*, users(id, whatsapp_id_hash, whatsapp_id_encrypted)")
            .eq("comunicacion_id", comunicacion_id)
            .neq("estado", "confirmado")
            .execute()
        )
        return res.data or []

    async def get_metricas(self, comunicacion_id: str) -> dict:
        res = await (
            self._db.table("comunicacion_destinatarios")
            .select("estado")
            .eq("comunicacion_id", comunicacion_id)
            .execute()
        )
        rows = res.data or []
        counts: dict[str, int] = {}
        for r in rows:
            counts[r["estado"]] = counts.get(r["estado"], 0) + 1
        return {
            "enviados": len(rows),
            "entregados": counts.get("entregado", 0) + counts.get("leido", 0) + counts.get("confirmado", 0),
            "leidos": counts.get("leido", 0) + counts.get("confirmado", 0),
            "confirmados": counts.get("confirmado", 0),
        }

    async def update_estado_row(self, row_id: str, estado: str, extra: dict | None = None) -> None:
        payload: dict = {"estado": estado}
        if extra:
            payload.update(extra)
        await (
            self._db.table("comunicacion_destinatarios")
            .update(payload)
            .eq("id", row_id)
            .execute()
        )
