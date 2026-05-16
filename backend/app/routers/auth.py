from fastapi import APIRouter, Depends, status
from supabase._async.client import AsyncClient

from app.db.supabase import get_supabase
from app.dependencies.auth import get_current_user
from app.repositories.mfa_repository import MfaRepository
from app.repositories.token_repository import TokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    SwitchRoleRequest,
    ActivateRequest,
    LoginRequest,
    LogoutRequest,
    MfaChallengeRequest,
    MfaDisableRequest,
    MfaEnableRequest,
    MfaSetupResponse,
    MfaStatusResponse,
    RefreshRequest,
)
from app.schemas.user import ActivateResponse, LoginResponse, RefreshResponse, UserMe
from app.services.auth_service import AuthService
from app.services.mfa_service import MfaService

router = APIRouter(prefix="/auth", tags=["auth"])


def _svc(db: AsyncClient = Depends(get_supabase)) -> AuthService:
    return AuthService(UserRepository(db), TokenRepository(db))


def _mfa_svc(db: AsyncClient = Depends(get_supabase)) -> MfaService:
    return MfaService(MfaRepository(db), UserRepository(db), TokenRepository(db))


@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest, svc: AuthService = Depends(_svc)):
    return await svc.login(data)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(data: RefreshRequest, svc: AuthService = Depends(_svc)):
    return await svc.refresh(data.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(data: LogoutRequest, svc: AuthService = Depends(_svc)):
    await svc.logout(data.refresh_token)


@router.post("/activate", response_model=ActivateResponse)
async def activate(data: ActivateRequest, svc: AuthService = Depends(_svc)):
    return await svc.activate(data)


@router.get("/me", response_model=UserMe)
async def me(current_user: dict = Depends(get_current_user), svc: AuthService = Depends(_svc)):
    user_me = await svc.get_me(current_user["id"])
    # Override role with JWT role (supports switchRole without touching DB)
    user_me.role = current_user.get("role", user_me.role)
    return user_me



@router.post("/switch-role", response_model=RefreshResponse)
async def switch_role(
    data: SwitchRoleRequest,
    current_user: dict = Depends(get_current_user),
    svc: AuthService = Depends(_svc),
):
    """Cambia el rol activo del usuario y emite nuevos tokens."""
    return await svc.switch_role(str(current_user["id"]), data.role)


# ── MFA ────────────────────────────────────────────────────────────────────

@router.post("/mfa/challenge", response_model=LoginResponse)
async def mfa_challenge(data: MfaChallengeRequest, svc: MfaService = Depends(_mfa_svc)):
    return await svc.challenge(data.mfa_token, data.code)


@router.get("/mfa/setup", response_model=MfaSetupResponse)
async def mfa_setup(
    current_user: dict = Depends(get_current_user),
    svc: MfaService = Depends(_mfa_svc),
):
    return svc.setup(str(current_user["id"]), current_user["email"])


@router.post("/mfa/enable", response_model=MfaStatusResponse)
async def mfa_enable(
    data: MfaEnableRequest,
    current_user: dict = Depends(get_current_user),
    svc: MfaService = Depends(_mfa_svc),
):
    await svc.enable(str(current_user["id"]), data.code, data.secret)
    return MfaStatusResponse(mfa_enabled=True)


@router.post("/mfa/disable", response_model=MfaStatusResponse)
async def mfa_disable(
    data: MfaDisableRequest,
    current_user: dict = Depends(get_current_user),
    svc: MfaService = Depends(_mfa_svc),
):
    await svc.disable(str(current_user["id"]), data.code)
    return MfaStatusResponse(mfa_enabled=False)
