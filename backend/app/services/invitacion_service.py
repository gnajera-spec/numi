"""Servicio de invitaciones para onboarding de colaboradores."""
import csv
import hashlib
import io
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status

from app.repositories.invitacion_repository import InvitacionRepository
from app.repositories.user_repository import UserRepository
from app.repositories.tenant_repository import TenantRepository
from app.schemas.invitaciones import (
    CompletarOnboardingRequest,
    InvitacionCreada,
    InvitarIndividualRequest,
    InvitarLoteItem,
    LoteResultado,
    OnboardingTokenInfo,
)


class InvitacionService:
    def __init__(
        self,
        inv_repo: InvitacionRepository,
        user_repo: UserRepository,
        tenant_repo: TenantRepository,
        frontend_url: str,
    ) -> None:
        self._inv = inv_repo
        self._users = user_repo
        self._tenants = tenant_repo
        self._frontend_url = frontend_url

    # ── Individual ────────────────────────────────────────────────

    async def invitar_individual(
        self,
        tenant_id: str,
        created_by: str,
        data: InvitarIndividualRequest,
    ) -> InvitacionCreada:
        await self._validar_cuil_email(data.cuil, str(data.email), tenant_id)

        row = await self._inv.create({
            "tenant_id": tenant_id,
            "cuil": data.cuil,
            "email": str(data.email),
            "created_by": created_by,
        })
        return self._to_creada(row)

    # ── Lote ─────────────────────────────────────────────────────

    async def invitar_lote(
        self,
        tenant_id: str,
        created_by: str,
        items: list[InvitarLoteItem],
    ) -> LoteResultado:
        exitosos: list[InvitacionCreada] = []
        errores: list[dict] = []

        for item in items:
            try:
                await self._validar_cuil_email(item.cuil, str(item.email), tenant_id)
                row = await self._inv.create({
                    "tenant_id": tenant_id,
                    "cuil": item.cuil,
                    "email": str(item.email),
                    "created_by": created_by,
                })
                exitosos.append(self._to_creada(row))
            except HTTPException as e:
                errores.append({"cuil": item.cuil, "email": str(item.email), "error": e.detail})

        return LoteResultado(exitosos=exitosos, errores=errores)

    @staticmethod
    def parse_csv(content: bytes) -> list[InvitarLoteItem]:
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        items = []
        for row in reader:
            cuil = (row.get("cuil") or row.get("CUIL") or "").strip()
            email = (row.get("email") or row.get("EMAIL") or "").strip()
            if cuil and email:
                items.append(InvitarLoteItem(cuil=cuil, email=email))
        return items

    # ── Onboarding público ────────────────────────────────────────

    async def get_token_info(self, token: str) -> OnboardingTokenInfo:
        inv = await self._inv.get_by_token(token)
        self._assert_token_valid(inv, token)
        tenant_nombre = (inv.get("tenants") or {}).get("nombre", "")
        return OnboardingTokenInfo(
            cuil=inv["cuil"],
            email=inv["email"],
            tenant_nombre=tenant_nombre,
            expires_at=inv["expires_at"],
        )

    async def completar_onboarding(
        self,
        token: str,
        data: CompletarOnboardingRequest,
    ) -> dict:
        inv = await self._inv.get_by_token(token)
        self._assert_token_valid(inv, token)

        # Email duplicado global
        if await self._users.get_by_email(str(data.email)):
            raise HTTPException(status.HTTP_409_CONFLICT, "El email ya está registrado")

        # CUIL duplicado en tenant
        if await self._users.get_by_cuil_and_tenant(inv["cuil"], inv["tenant_id"]):
            raise HTTPException(status.HTTP_409_CONFLICT, "El CUIL ya está registrado en este tenant")

        password_hash = hashlib.sha256(data.password.encode()).hexdigest()

        user = await self._users.create(
            inv["tenant_id"],
            {
                "email": str(data.email),
                "first_name": data.nombre,
                "last_name": data.apellido,
                "cuil": inv["cuil"],
                "nro_documento": data.nro_documento,
                "role": "colaborador",
                "roles": ["colaborador"],
                "password_hash": password_hash,
                "estado": "activo",
                "activated_at": datetime.now(timezone.utc).isoformat(),
            },
            created_by=inv.get("created_by"),
        )

        await self._inv.mark_completed(token)
        return {"message": "Registro completado exitosamente", "user_id": str(user["id"])}

    # ── Helpers ───────────────────────────────────────────────────

    def _to_creada(self, row: dict) -> InvitacionCreada:
        link = f"{self._frontend_url}/onboarding/{row['token']}"
        return InvitacionCreada(
            token=row["token"],
            email=row["email"],
            cuil=row["cuil"],
            link=link,
            expires_at=row["expires_at"],
        )

    async def _validar_cuil_email(self, cuil: str, email: str, tenant_id: str) -> None:
        # No permitir CUIL con invitación pendiente en el mismo tenant
        existente = await self._inv.get_by_cuil_and_tenant(cuil, tenant_id)
        if existente:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Ya existe una invitación pendiente para el CUIL {cuil}")

        # No permitir si el usuario ya existe en el tenant
        if await self._users.get_by_cuil_and_tenant(cuil, tenant_id):
            raise HTTPException(status.HTTP_409_CONFLICT, f"El CUIL {cuil} ya pertenece a un usuario activo")

    @staticmethod
    def _assert_token_valid(inv: dict | None, token: str) -> None:
        if not inv:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitación no encontrada")
        if inv["estado"] == "completada":
            raise HTTPException(status.HTTP_409_CONFLICT, "Este enlace de invitación ya fue utilizado")
        if inv["estado"] == "expirada":
            raise HTTPException(status.HTTP_410_GONE, "Este enlace de invitación ha expirado")
        expires = inv["expires_at"]
        if isinstance(expires, str):
            expires = datetime.fromisoformat(expires.replace("Z", "+00:00"))
        if expires < datetime.now(timezone.utc):
            raise HTTPException(status.HTTP_410_GONE, "Este enlace de invitación ha expirado")
