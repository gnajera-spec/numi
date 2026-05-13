from supabase._async.client import AsyncClient


class UploadJobRepository:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    async def create(
        self,
        job_id: str,
        tenant_id: str,
        periodo_id: str,
        files: list[dict],
    ) -> None:
        await self._db.table("upload_jobs").insert({
            "id": job_id,
            "tenant_id": tenant_id,
            "periodo_id": periodo_id,
            "files": files,
        }).execute()

    async def get(self, job_id: str, tenant_id: str, periodo_id: str) -> dict | None:
        res = (
            await self._db.table("upload_jobs")
            .select("*")
            .eq("id", job_id)
            .eq("tenant_id", tenant_id)
            .eq("periodo_id", periodo_id)
            .gt("expires_at", "now()")
            .execute()
        )
        return res.data[0] if res.data else None

    async def delete(self, job_id: str) -> None:
        await self._db.table("upload_jobs").delete().eq("id", job_id).execute()
