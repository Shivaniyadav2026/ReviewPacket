from __future__ import annotations

from logging.config import dictConfig
from pathlib import Path

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "reviewpackets.log"


def build_uvicorn_log_config() -> dict:
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
            },
            "access": {
                "format": "%(asctime)s | %(levelname)s | %(client_addr)s - \"%(request_line)s\" %(status_code)s"
            },
        },
        "handlers": {
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "formatter": "default",
                "filename": str(LOG_FILE),
                "maxBytes": 2_000_000,
                "backupCount": 3,
                "encoding": "utf-8",
            },
            "access_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "formatter": "access",
                "filename": str(LOG_FILE),
                "maxBytes": 2_000_000,
                "backupCount": 3,
                "encoding": "utf-8",
            },
        },
        "loggers": {
            "uvicorn": {"handlers": ["file"], "level": "INFO", "propagate": False},
            "uvicorn.error": {"handlers": ["file"], "level": "INFO", "propagate": False},
            "uvicorn.access": {"handlers": ["access_file"], "level": "INFO", "propagate": False},
        },
    }


def configure_uvicorn_logging() -> None:
    dictConfig(build_uvicorn_log_config())
