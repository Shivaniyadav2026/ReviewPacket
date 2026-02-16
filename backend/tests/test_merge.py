import pandas as pd
from backend.utils.merge import merge_duplicate_columns


def test_merge_duplicate_columns():
    data = [
        ["ABC-1", "One", "One", "", "Extra"],
        ["ABC-2", "Two", "Two", "done", ""],
    ]
    columns = ["Issue Key", "Summary", "Summary", "Review Info", "Review Info"]
    df = pd.DataFrame(data, columns=columns)

    merged = merge_duplicate_columns(df)
    assert list(merged.columns).count("Summary") == 1
    assert list(merged.columns).count("Review Info") == 1
    assert merged.loc[0, "Review Info"] == "Extra"
    assert merged.loc[1, "Review Info"] == "done"


def test_merge_duplicate_columns_concat():
    data = [["ABC-3", "A", "B"]]
    columns = ["Issue Key", "Solution", "Solution.1"]
    df = pd.DataFrame(data, columns=columns)
    merged = merge_duplicate_columns(df)
    assert merged.loc[0, "Solution"] in ("A | B", "B | A")
