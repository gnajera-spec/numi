from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    supabase_url: str
    supabase_service_role_key: str
    secret_key: str
    allowed_origins: List[str] = ["http://localhost:5173", "http://localhost:5580"]

    # Meta Cloud API / WhatsApp
    meta_verify_token: str = ""
    meta_app_secret: str = ""

    frontend_url: str = "http://localhost:5580"

    # AES-256 encryption key (64-char hex = 32 bytes). Required for whatsapp_config and medical data.
    encryption_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
