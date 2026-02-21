from pathlib import Path

APP_NAME = "ReviewPackets"
DEFAULT_FILTERS = [
    "Summary",
    "Priority",
    "Status",
    "Review Info",
    "Solution",
    "Description",
]

MAX_UPLOAD_MB = 200

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_COLLABORATOR_CONFIG_PATH = Path(__file__).resolve().parent / "collaborator_config.json"
DEFAULT_DOWNLOADS_DIR = Path(__file__).resolve().parent.parent / "Downloads"
