import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        tb = traceback.format_exc()
        logger.error("Unhandled exception on %s %s\n%s", request.method, request.url, tb)
        # In development, return the actual error detail
        import os
        if os.getenv("APP_ENV") == "development":
            return JSONResponse(
                status_code=500,
                content={"detail": str(exc), "traceback": tb[-2000:]},
            )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )
