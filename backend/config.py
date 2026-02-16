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
