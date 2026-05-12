from supabase._async.client import AsyncClient, create_client

from app.core.config import get_settings

_client: AsyncClient | None = None


async def get_supabase() -> AsyncClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = await create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client
