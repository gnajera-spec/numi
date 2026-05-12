from typing import Any

from supabase._async.client import AsyncClient

_TABLE = "whatsapp_message_log"


class WhatsappLogRepository:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    async def log(
        self,
        *,
        tenant_id: str,
        direction: str,
        tipo: str,
        user_id: str | None = None,
        wa_message_id: str | None = None,
        contenido: str | None = None,
        template_name: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        payload: dict[str, Any] = {
            "tenant_id": tenant_id,
            "direction": direction,
            "tipo": tipo,
        }
        if user_id:
            payload["user_id"] = user_id
        if wa_message_id:
            payload["wa_message_id"] = wa_message_id
        if contenido:
            payload["contenido"] = contenido
        if template_name:
            payload["template_name"] = template_name
        if metadata:
            payload["metadata"] = metadata

        try:
            await self._db.table(_TABLE).insert(payload).execute()
        except Exception:
            # log errors must not break the main flow
            pass
