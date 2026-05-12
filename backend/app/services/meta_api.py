"""
Client for the Meta Cloud API (WhatsApp Business Platform).
All methods raise httpx.HTTPStatusError on API errors.
"""
from typing import Any

import httpx

_BASE = "https://graph.facebook.com/v20.0"
_TIMEOUT = 10.0


class MetaApiClient:
    def __init__(self, phone_number_id: str, access_token: str) -> None:
        self._phone_number_id = phone_number_id
        self._headers = {"Authorization": f"Bearer {access_token}"}

    def _url(self) -> str:
        return f"{_BASE}/{self._phone_number_id}/messages"

    async def send_text(self, to: str, body: str) -> dict[str, Any]:
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": body, "preview_url": False},
        }
        return await self._post(payload)

    async def send_template(
        self,
        to: str,
        template_name: str,
        components: list[dict] | None = None,
        language: str = "es_AR",
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language},
            },
        }
        if components:
            payload["template"]["components"] = components
        return await self._post(payload)

    async def send_document(self, to: str, link: str, filename: str, caption: str | None = None) -> dict[str, Any]:
        doc: dict[str, Any] = {"link": link, "filename": filename}
        if caption:
            doc["caption"] = caption
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "document",
            "document": doc,
        }
        return await self._post(payload)

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.post(self._url(), json=payload, headers=self._headers)
            r.raise_for_status()
            return r.json()
