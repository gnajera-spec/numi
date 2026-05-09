from fastapi import APIRouter, Depends, status
from supabase._async.client import AsyncClient

from app.db.supabase import get_supabase
from app.dependencies.auth import get_current_user
from app.repositories.token_repository import TokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import ActivateRequest, LoginRequest, LogoutRequest, RefreshRequest
from app.schemas.user import ActivateResponse, LoginResponse, RefreshResponse, UserMe
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _svc(db: AsyncClient = Depends(get_supabase)) -> AuthService:
    return AuthService(UserRepository(db), TokenRepository(db))


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
    return await svc.get_me(current_user["id"])
