from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import router
from backend.utils.logger import setup_logging
from backend.utils.uvicorn_logging import build_uvicorn_log_config


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
