import pandas as pd
from backend.repositories.data_store import DATA_STORE
from backend.services.preview_service import PreviewService


def test_preview_comments():
    df = pd.DataFrame(
        [
            ["ABC-1", "Sum1", "", "done"],
            ["ABC-2", "Sum2", "ready", ""],
        ],
        columns=["Issue Key", "Summary", "Review Info", "Solution"],
    )

    with DATA_STORE.lock:
        DATA_STORE.dump_df = df
        DATA_STORE.issue_keys = ["ABC-1", "ABC-2"]

    service = PreviewService()
    preview = service.build_preview(["Review Info", "Solution"])
    rows = preview.to_dict(orient="records")

    assert rows[0]["Comment"] == "Review Info is blank"
    assert rows[1]["Comment"] == "Solution is blank"


def test_preview_all_complete():
    df = pd.DataFrame(
        [["ABC-3", "Sum3", "yes", "yes"]],
        columns=["Issue Key", "Summary", "Review Info", "Solution"],
    )

    with DATA_STORE.lock:
        DATA_STORE.dump_df = df
        DATA_STORE.issue_keys = ["ABC-3"]

    service = PreviewService()
    preview = service.build_preview(["Review Info", "Solution"])
    rows = preview.to_dict(orient="records")
    assert rows[0]["Comment"] == "Review completed"
