from functools import lru_cache

from supabase._async.client import AsyncClient, create_client

from app.core.config import get_settings


@lru_cache
def _get_client() -> AsyncClient:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


async def get_supabase() -> AsyncClient:
    return _get_client()
