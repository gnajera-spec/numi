from supabase._async.client import AsyncClient


class MfaRepository:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    async def get_mfa_data(self, user_id: str) -> dict | None:
        resp = await (
            self._db.table("users")
            .select("id, mfa_enabled, mfa_secret_encrypted, mfa_backup_codes_encrypted")
            .eq("id", user_id)
            .single()
            .execute()
        )
        return resp.data

    async def enable_mfa(
        self,
        user_id: str,
        secret_encrypted: str,
        backup_codes_encrypted: str,
    ) -> None:
        await (
            self._db.table("users")
            .update(
                {
                    "mfa_enabled": True,
                    "mfa_secret_encrypted": secret_encrypted,
                    "mfa_backup_codes_encrypted": backup_codes_encrypted,
                }
            )
            .eq("id", user_id)
            .execute()
        )

    async def disable_mfa(self, user_id: str) -> None:
        await (
            self._db.table("users")
            .update(
                {
                    "mfa_enabled": False,
                    "mfa_secret_encrypted": None,
                    "mfa_backup_codes_encrypted": None,
                }
            )
            .eq("id", user_id)
            .execute()
        )
