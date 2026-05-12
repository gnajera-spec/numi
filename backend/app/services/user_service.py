import hashlib
import math
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status

from app.repositories.colaborador_repository import ColaboradorRepository
from app.repositories.token_repository import TokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.users import (
    BajaRequest,
    CreateUserRequest,
    InviteResponse,
    PaginatedUsers,
    Pagination,
    UpdateOwnProfileRequest,
    UpdateUserRequest,
    UserDetail,
)
from app.schemas.user import UserSummary

_INVITE_TTL = timedelta(hours=48)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _mask_whatsapp(numero: str) -> str:
    if len(numero) <= 7:
        return "****"
    return f"{numero[:3]}****{numero[-4:]}"


def _build_pagination(total: int, page: int, page_size: int, base_path: str) -> Pagination:
    pages = math.ceil(total / page_size) if total > 0 else 1
    next_url = f"{base_path}?page={page + 1}&page_size={page_size}" if page < pages else None
    prev_url = f"{base_path}?page={page - 1}&page_size={page_size}" if page > 1 else None
    return Pagination(total=total, page=page, page_size=page_size, pages=pages, next=next_url, prev=prev_url)


class UserService:
    def __init__(
        self,
        user_repo: UserRepository,
        token_repo: TokenRepository,
        colaborador_repo: ColaboradorRepository,
        encryption_key: str | None = None,
    ) -> None:
        self._users = user_repo
        self._tokens = token_repo
        self._colaboradores = colaborador_repo
        self._encryption_key = encryption_key

    # ── List ─────────────────────────────────────────────────────

    async def list_users(
        self,
        tenant_id: str,
        *,
        role: str | None = None,
        estado: str | None = None,
        sede_id: str | None = None,
        departamento_id: str | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedUsers:
        rows, total = await self._users.list_users(
            tenant_id,
            role=role,
            estado=estado,
            sede_id=sede_id,
            departamento_id=departamento_id,
            search=search,
            page=page,
            page_size=page_size,
        )
        users = [UserSummary.model_validate(r) for r in rows]
        pagination = _build_pagination(total, page, page_size, "/users")
        return PaginatedUsers(data=users, pagination=pagination)

    # ── Create ───────────────────────────────────────────────────

    async def create_user(
        self,
        tenant_id: str,
        created_by_id: str | UUID,
        data: CreateUserRequest,
    ) -> UserDetail:
        # Duplicate email check (global)
        if await self._users.get_by_email(str(data.email)):
            raise HTTPException(status.HTTP_409_CONFLICT, "El email ya está registrado")

        # Duplicate CUIL check within tenant
        if await self._users.get_by_cuil_and_tenant(data.cuil, tenant_id):
            raise HTTPException(status.HTTP_409_CONFLICT, "El CUIL ya está registrado en este tenant")

        masked = _mask_whatsapp(data.whatsapp_numero)
        # wa_id is the phone number in E.164 format without the leading '+'
        wa_id = data.whatsapp_numero.lstrip("+")
        wa_hash = hashlib.sha256(wa_id.encode()).hexdigest()

        user_data: dict = {
            "email": str(data.email),
            "first_name": data.first_name,
            "last_name": data.last_name,
            "cuil": data.cuil,
            "role": data.role,
            "whatsapp_numero_masked": masked,
            "whatsapp_id_hash": wa_hash,
        }

        if self._encryption_key:
            from app.utils.encryption import encrypt
            user_data["whatsapp_id_encrypted"] = encrypt(wa_id, self._encryption_key)

        user = await self._users.create(
            tenant_id,
            user_data,
            created_by=created_by_id,
        )

        if data.role == "colaborador":
            await self._colaboradores.create(
                user["id"],
                tenant_id,
                {
                    "sede_id": data.sede_id,
                    "departamento_id": data.departamento_id,
                    "puesto_id": data.puesto_id,
                    "convenio_id": data.convenio_id,
                    "legajo": data.legajo,
                    "fecha_ingreso": data.fecha_ingreso,
                    "tipo_contrato": data.tipo_contrato,
                },
            )

        # Generate invite token (WhatsApp send deferred — not yet implemented)
        await self._generate_invite(user["id"], created_by_id)

        full = await self._users.get_by_id_with_profile(user["id"])
        return UserDetail.model_validate(full)

    # ── Get ──────────────────────────────────────────────────────

    async def get_user(self, user_id: str | UUID, current_user: dict) -> UserDetail:
        user = await self._users.get_by_id_with_profile(user_id)
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

        self._assert_same_tenant(user, current_user)

        # Collaborators can only see their own profile
        if current_user["role"] == "colaborador" and str(user["id"]) != str(current_user["id"]):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

        return UserDetail.model_validate(user)

    # ── Update ───────────────────────────────────────────────────

    async def update_user(
        self,
        user_id: str | UUID,
        data: UpdateUserRequest | UpdateOwnProfileRequest,
        current_user: dict,
    ) -> UserDetail:
        user = await self._users.get_by_id(user_id)
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

        self._assert_same_tenant(user, current_user)

        if isinstance(data, UpdateOwnProfileRequest):
            if str(user["id"]) != str(current_user["id"]):
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")
            await self._colaboradores.update(user_id, data.model_dump(exclude_none=True))
        else:
            # rrhh+ updating any user in their tenant
            user_payload = data.model_dump(include={"first_name", "last_name"}, exclude_none=True)
            if user_payload:
                await self._users.update(user_id, user_payload)

            profile_payload = data.model_dump(
                include={"sede_id", "departamento_id", "puesto_id", "convenio_id", "legajo", "tipo_contrato", "fecha_ingreso"},
                exclude_none=True,
            )
            if profile_payload and user.get("role") == "colaborador":
                await self._colaboradores.update(user_id, profile_payload)

        full = await self._users.get_by_id_with_profile(user_id)
        return UserDetail.model_validate(full)

    # ── Invite ───────────────────────────────────────────────────

    async def invite_user(
        self, user_id: str | UUID, created_by_id: str | UUID, tenant_id: str
    ) -> InviteResponse:
        user = await self._users.get_by_id(user_id)
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

        if str(user.get("tenant_id")) != tenant_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

        if user["estado"] == "baja":
            raise HTTPException(status.HTTP_409_CONFLICT, "No se puede invitar a un usuario dado de baja")

        expires_at = await self._generate_invite(user_id, created_by_id)
        return InviteResponse(expires_at=expires_at)

    # ── Lifecycle ─────────────────────────────────────────────────

    async def suspend_user(self, user_id: str | UUID, tenant_id: str) -> None:
        user = await self._users.get_by_id(user_id)
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

        self._assert_tenant(user, tenant_id)

        if user["estado"] != "activo":
            raise HTTPException(status.HTTP_409_CONFLICT, f"No se puede suspender un usuario en estado '{user['estado']}'")

        await self._users.suspend(user_id)
        await self._tokens.revoke_all_user_tokens(user_id)

    async def reactivate_user(self, user_id: str | UUID, tenant_id: str) -> UserDetail:
        user = await self._users.get_by_id(user_id)
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

        self._assert_tenant(user, tenant_id)

        if user["estado"] != "suspendido":
            raise HTTPException(status.HTTP_409_CONFLICT, f"Solo se puede reactivar un usuario suspendido (estado actual: '{user['estado']}')")

        updated = await self._users.reactivate(user_id)
        return UserDetail.model_validate(updated)

    async def baja_user(self, user_id: str | UUID, tenant_id: str, data: BajaRequest) -> None:
        user = await self._users.get_by_id(user_id)
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

        self._assert_tenant(user, tenant_id)

        if user["estado"] == "baja":
            raise HTTPException(status.HTTP_409_CONFLICT, "El usuario ya está dado de baja")

        baja_at = None
        if data.fecha_baja:
            baja_at = datetime(data.fecha_baja.year, data.fecha_baja.month, data.fecha_baja.day, tzinfo=timezone.utc)

        await self._users.baja(user_id, baja_at)
        await self._tokens.revoke_all_user_tokens(user_id)

    # ── Private helpers ───────────────────────────────────────────

    async def _generate_invite(self, user_id: str | UUID, created_by: str | UUID) -> datetime:
        await self._tokens.invalidate_pending_invites(user_id)
        plain = secrets.token_urlsafe(32)
        token_hash = _hash_token(plain)
        expires_at = datetime.now(timezone.utc) + _INVITE_TTL
        await self._tokens.create_invite_token(user_id, created_by, token_hash, expires_at)
        return expires_at

    @staticmethod
    def _assert_same_tenant(target_user: dict, current_user: dict) -> None:
        if str(target_user.get("tenant_id")) != str(current_user.get("tenant_id")):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

    @staticmethod
    def _assert_tenant(user: dict, tenant_id: str) -> None:
        if str(user.get("tenant_id")) != tenant_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
