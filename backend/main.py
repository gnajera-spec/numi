from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exception_handlers import register_exception_handlers

settings = get_settings()

app = FastAPI(
    title="NUMI API",
    version="1.0.0",
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url=None,
)

# Hardcoded origins — includes all dev ports to avoid Pydantic parsing issues
_allowed_origins = list(settings.allowed_origins) if settings.allowed_origins else []
for _dev_origin in ["http://localhost:5173", "http://localhost:5580", "http://localhost:5174"]:
    if _dev_origin not in _allowed_origins:
        _allowed_origins.append(_dev_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

from app.routers import auth as auth_router  # noqa: E402
from app.routers import users as users_router  # noqa: E402
from app.routers import recibos as recibos_router  # noqa: E402
from app.routers import whatsapp as whatsapp_router  # noqa: E402
from app.routers import licencias as licencias_router  # noqa: E402
from app.routers import comunicaciones as comunicaciones_router  # noqa: E402
from app.routers import medico as medico_router  # noqa: E402
from app.routers import reportes as reportes_router  # noqa: E402
from app.routers import tenants as tenants_router  # noqa: E402
from app.routers import invitaciones as invitaciones_router  # noqa: E402
from app.routers import smtp_config as smtp_config_router  # noqa: E402

app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(recibos_router.router)
app.include_router(whatsapp_router.router)
app.include_router(licencias_router.router)
app.include_router(comunicaciones_router.router)
app.include_router(medico_router.router)
app.include_router(reportes_router.router)
app.include_router(tenants_router.router)
app.include_router(invitaciones_router.router)
app.include_router(smtp_config_router.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
