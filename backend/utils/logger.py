from pathlib import Path
import logging
import os
from logging.handlers import RotatingFileHandler


def _resolve_log_dir() -> Path:
    override = os.getenv("REVIEWPACKETS_LOG_DIR", "").strip()
    if override:
        target = Path(override)
    else:
        appdata = os.getenv("LOCALAPPDATA") or os.getenv("APPDATA")
        if appdata:
            target = Path(appdata) / "ReviewPackets" / "logs"
        else:
            target = Path.cwd() / "logs"
    target.mkdir(parents=True, exist_ok=True)
    return target


LOG_DIR = _resolve_log_dir()
LOG_FILE = LOG_DIR / "reviewpackets.log"
COLLABORATOR_LOG_FILE = LOG_DIR / "collaborator-backend.log"


def setup_logging() -> None:
    logger = logging.getLogger()
    if logger.handlers:
        return
    logger.setLevel(logging.INFO)

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )

    file_handler = RotatingFileHandler(LOG_FILE, maxBytes=2_000_000, backupCount=3)
    file_handler.setFormatter(formatter)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    collaborator_logger = logging.getLogger("collaborator")
    collaborator_logger.setLevel(logging.INFO)
    collaborator_logger.propagate = False

    collaborator_handler = RotatingFileHandler(
        COLLABORATOR_LOG_FILE,
        maxBytes=2_000_000,
        backupCount=3,
    )
    collaborator_handler.setFormatter(formatter)

    collaborator_console = logging.StreamHandler()
    collaborator_console.setFormatter(formatter)

    collaborator_logger.addHandler(collaborator_handler)
    collaborator_logger.addHandler(collaborator_console)
