from supabase._async.client import AsyncClient


class ComunicacionAdjuntoRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def create(self, data: dict) -> dict:
        payload = {
            "comunicacion_id": data["comunicacion_id"],
            "filename": data["filename"],
            "storage_path": data["storage_path"],
            "file_url": data["file_url"],
            "file_size_bytes": data["file_size_bytes"],
            "mime_type": data["mime_type"],
        }
        res = await (
            self._db.table("comunicacion_adjuntos")
            .insert(payload)
            .select()
            .execute()
        )
        return res.data[0]

    async def list_by_comunicacion(self, comunicacion_id: str) -> list[dict]:
        res = await (
            self._db.table("comunicacion_adjuntos")
            .select("id, filename, file_url, file_size_bytes, mime_type, created_at")
            .eq("comunicacion_id", comunicacion_id)
            .execute()
        )
        return res.data or []

    async def upload_and_create(
        self,
        client: AsyncClient,
        comunicacion_id: str,
        tenant_id: str,
        filename: str,
        content: bytes,
        mime_type: str,
    ) -> dict:
        storage_path = f"{tenant_id}/{comunicacion_id}/{filename}"
        await client.storage.from_("comunicaciones").upload(
            storage_path, content, {"content-type": mime_type}
        )
        signed = await client.storage.from_("comunicaciones").create_signed_url(
            storage_path, 60 * 60 * 24 * 365
        )
        file_url = signed.get("signedURL", "")
        return await self.create(
            {
                "comunicacion_id": comunicacion_id,
                "filename": filename,
                "storage_path": storage_path,
                "file_url": file_url,
                "file_size_bytes": len(content),
                "mime_type": mime_type,
            }
        )
