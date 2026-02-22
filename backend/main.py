from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.routes import router
from backend.utils.logger import setup_logging
from backend.utils.uvicorn_logging import build_uvicorn_log_config

logger = logging.getLogger("collaborator")


def create_app() -> FastAPI:
    setup_logging()
    app = FastAPI(title="ReviewPackets API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:4200", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router, prefix="/api")

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:  # type: ignore[override]
        body = (await request.body()).decode("utf-8", errors="ignore")
        logger.error(
            "Request validation failed: path=%s errors=%s body=%s",
            request.url.path,
            exc.errors(),
            body,
        )
        return JSONResponse(
            status_code=422,
            content={
                "detail": exc.errors(),
                "message": "Request validation failed. Check logs.txt for payload details.",
            },
        )

    return app


app = create_app()


def run() -> None:
    import uvicorn

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_config=build_uvicorn_log_config(),
    )


if __name__ == "__main__":
    run()