from __future__ import annotations

from pathlib import Path
import pandas as pd

from .merge import merge_duplicate_columns


SUPPORTED_EXTENSIONS = {".xlsx", ".xls", ".csv"}


def load_table(file_path: Path) -> pd.DataFrame:
    if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError("Unsupported file type. Use .xlsx, .xls, or .csv")

    if file_path.suffix.lower() == ".csv":
        df = pd.read_csv(file_path, dtype=str, keep_default_na=False)
    else:
        df = pd.read_excel(file_path, dtype=str, keep_default_na=False, engine="openpyxl")

    df = df.fillna("")
    df = merge_duplicate_columns(df)
    return df


def load_issue_keys(file_path: Path, issue_key_column: str = "Issue Key") -> list[str]:
    df = load_table(file_path)
    column = _find_column(df, issue_key_column)
    if column is None:
        raise ValueError(f"Missing required column: {issue_key_column}")

    keys = (
        df[column]
        .astype(str)
        .map(lambda value: value.strip())
        .tolist()
    )
    return [key for key in keys if key]


def _find_column(df: pd.DataFrame, name: str) -> str | None:
    target = name.strip().lower()
    for col in df.columns:
        if str(col).strip().lower() == target:
            return col
    return None
