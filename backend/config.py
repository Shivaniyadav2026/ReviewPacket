from pathlib import Path

APP_NAME = "ReviewPackets"
DEFAULT_FILTERS = [
    "Affects Version/s",
    "Component/s",
    "Priority",
    "Status",
    "Fix Version/s",
    "Labels",
    "Description",
    "Custom field (Category of Task)",
    "Custom field (Affected Subsystem/s)",
    "Custom field (Epic Link)",
    "Custom field (Acceptance Criteria)",
    "Custom field (Solution)",
    "Custom field (Review Info)",
    "Custom field (Issue Links)",
]

MAX_UPLOAD_MB = 200

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_COLLABORATOR_CONFIG_PATH = Path(__file__).resolve().parent / "collaborator_config.json"
DEFAULT_DOWNLOADS_DIR = Path(__file__).resolve().parent.parent / "Downloads"
