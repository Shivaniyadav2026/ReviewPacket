from pathlib import Path

APP_NAME = "ReviewPackets"
DEFAULT_FILTERS = [
    "Affects Version/s",
    "Components/s",
    "Priority",
    "Status",
    "Fix Version/s",
    "Labels",
    "Description",
    "Category of Task",
    "Affected Subsystem/s",
    "Epic Link",
    "Acceptance Criteria",
    "Solution",
    "Review Info",
    "Issue Links",
]

MAX_UPLOAD_MB = 200

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_COLLABORATOR_CONFIG_PATH = Path(__file__).resolve().parent / "collaborator_config.json"
DEFAULT_DOWNLOADS_DIR = Path(__file__).resolve().parent.parent / "Downloads"
