import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
import pyotp

from app.core.config import get_settings
from app.repositories.mfa_repository import MfaRepository
from app.repositories.token_repository import TokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import MfaSetupResponse
from app.schemas.user import LoginResponse, UserSummary
from app.utils.encryption import encrypt, decrypt
from fastapi import HTTPException, status

_MFA_TOKEN_TTL = timedelta(minutes=5)
_BACKUP_CODES_COUNT = 8


def _generate_backup_codes() -> list[str]:
    return [secrets.token_hex(4).upper() for _ in range(_BACKUP_CODES_COUNT)]


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _generate_refresh_token() -> str:
    return secrets.token_urlsafe(64)


class MfaService:
    def __init__(
        self,
        mfa_repo: MfaRepository,
        user_repo: UserRepository,
        token_repo: TokenRepository,
    ) -> None:
        self._mfa = mfa_repo
        self._users = user_repo
        self._tokens = token_repo
        self._settings = get_settings()

    def _issue_mfa_token(self, user_id: str) -> str:
        now = datetime.now(timezone.utc)
        payload = {
            "sub": user_id,
            "type": "mfa_challenge",
            "iat": now,
            "exp": now + _MFA_TOKEN_TTL,
        }
        return jwt.encode(payload, self._settings.secret_key, algorithm="HS256")

    def _verify_mfa_token(self, mfa_token: str) -> str:
        try:
            payload = jwt.decode(
                mfa_token, self._settings.secret_key, algorithms=["HS256"]
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "MFA token expirado")
        except jwt.InvalidTokenError:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "MFA token inválido")

        if payload.get("type") != "mfa_challenge":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "MFA token inválido")

        return payload["sub"]

    async def _issue_full_token_pair(self, user: dict) -> dict:
        from app.services.auth_service import _generate_access_token

        access_token = _generate_access_token(user, self._settings.secret_key)
        refresh_token = _generate_refresh_token()
        token_hash = _hash_token(refresh_token)
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        await self._tokens.create_refresh_token(user["id"], token_hash, expires_at)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    def setup(self, user_id: str, email: str) -> MfaSetupResponse:
        secret = pyotp.random_base32()
        totp = pyotp.TOTP(secret)
        qr_uri = totp.provisioning_uri(name=email, issuer_name="HRConnect")
        backup_codes = _generate_backup_codes()
        return MfaSetupResponse(secret=secret, qr_uri=qr_uri, backup_codes=backup_codes)

    async def enable(self, user_id: str, code: str, secret: str) -> None:
        totp = pyotp.TOTP(secret)
        if not totp.verify(code, valid_window=1):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Código TOTP inválido")

        backup_codes = _generate_backup_codes()
        secret_enc = encrypt(secret, self._settings.encryption_key)
        codes_enc = encrypt(",".join(backup_codes), self._settings.encryption_key)
        await self._mfa.enable_mfa(user_id, secret_enc, codes_enc)

    async def challenge(self, mfa_token: str, code: str) -> LoginResponse:
        user_id = self._verify_mfa_token(mfa_token)

        mfa_data = await self._mfa.get_mfa_data(user_id)
        if not mfa_data or not mfa_data.get("mfa_enabled"):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "MFA no habilitado")

        secret_enc = mfa_data.get("mfa_secret_encrypted")
        if not secret_enc:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error de configuración MFA")

        secret = decrypt(secret_enc, self._settings.encryption_key)

        # Try TOTP code
        totp = pyotp.TOTP(secret)
        valid = totp.verify(code, valid_window=1)

        # Try backup codes if TOTP fails
        if not valid:
            codes_enc = mfa_data.get("mfa_backup_codes_encrypted")
            if codes_enc:
                codes = decrypt(codes_enc, self._settings.encryption_key).split(",")
                if code.upper() in codes:
                    # Consume the backup code
                    remaining = [c for c in codes if c != code.upper()]
                    new_enc = encrypt(",".join(remaining), self._settings.encryption_key)
                    await self._mfa.enable_mfa(user_id, secret_enc, new_enc)
                    valid = True

        if not valid:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Código inválido")

        user = await self._users.get_by_id(user_id)
        if not user or user["estado"] != "activo":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario inactivo")

        await self._users.update_last_login(user_id)
        token_pair = await self._issue_full_token_pair(user)
        return LoginResponse(user=UserSummary.model_validate(user), **token_pair)

    async def disable(self, user_id: str, code: str) -> None:
        mfa_data = await self._mfa.get_mfa_data(user_id)
        if not mfa_data or not mfa_data.get("mfa_enabled"):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "MFA no está habilitado")

        secret_enc = mfa_data.get("mfa_secret_encrypted")
        if not secret_enc:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error de configuración MFA")

        secret = decrypt(secret_enc, self._settings.encryption_key)
        totp = pyotp.TOTP(secret)
        if not totp.verify(code, valid_window=1):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Código TOTP inválido")

        await self._mfa.disable_mfa(user_id)
