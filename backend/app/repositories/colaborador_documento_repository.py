import uuid as _uuid

from supabase._async.client import AsyncClient

BUCKET = "colaborador-documentos"


class ColaboradorDocumentoRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def list_by_user(self, user_id: str, tenant_id: str) -> list[dict]:
        res = await (
            self._db.table("colaborador_documentos")
            .select("id, tipo, filename, file_url, file_size_bytes, mime_type, descripcion, uploaded_by, created_at")
            .eq("user_id", user_id)
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    async def upload_and_create(
        self,
        client: AsyncClient,
        user_id: str,
        tenant_id: str,
        uploaded_by: str,
        tipo: str,
        descripcion: str | None,
        filename: str,
        content: bytes,
        mime_type: str,
    ) -> dict:
        file_id = str(_uuid.uuid4())
        storage_path = f"{tenant_id}/{user_id}/{file_id}-{filename}"
        await client.storage.from_(BUCKET).upload(
            storage_path, content, {"content-type": mime_type}
        )
        signed = await client.storage.from_(BUCKET).create_signed_url(
            storage_path, 60 * 60 * 24 * 365
        )
        file_url = signed.get("signedURL", "")
        payload = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "tipo": tipo,
            "filename": filename,
            "storage_path": storage_path,
            "file_url": file_url,
            "file_size_bytes": len(content),
            "mime_type": mime_type,
            "uploaded_by": uploaded_by,
        }
        if descripcion:
            payload["descripcion"] = descripcion
        res = await (
            self._db.table("colaborador_documentos")
            .insert(payload)
            .select("id, tipo, filename, file_url, file_size_bytes, mime_type, descripcion, uploaded_by, created_at")
            .execute()
        )
        return res.data[0]

    async def delete(self, doc_id: str, user_id: str, tenant_id: str) -> None:
        res = await (
            self._db.table("colaborador_documentos")
            .select("storage_path")
            .eq("id", doc_id)
            .eq("user_id", user_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return
        storage_path = res.data[0]["storage_path"]
        await self._db.table("colaborador_documentos").delete().eq("id", doc_id).execute()
        try:
            await self._db.storage.from_(BUCKET).remove([storage_path])
        except Exception:
            pass
