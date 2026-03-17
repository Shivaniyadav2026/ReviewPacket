from __future__ import annotations

import pandas as pd
import re

_DUPLICATE_HEADER_PATTERN = re.compile(r"^(.*)\.(\d+)$")


def _normalize_value(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and pd.isna(value):
        return ""
    text = str(value).strip()
    return text


def merge_duplicate_columns(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    columns = list(df.columns)
    normalized_columns = normalize_duplicate_headers(columns)
    seen = set()
    merged_columns = []
    merged_data = []

    for idx, name in enumerate(normalized_columns):
        if name in seen:
            continue
        seen.add(name)
        duplicate_indices = [i for i, col in enumerate(normalized_columns) if col == name]

        if len(duplicate_indices) == 1:
            merged_columns.append(name)
            merged_data.append(df.iloc[:, duplicate_indices[0]])
            continue

        duplicate_frame = df.iloc[:, duplicate_indices]
        merged_series = duplicate_frame.apply(_merge_row_values, axis=1)

        merged_columns.append(name)
        merged_data.append(merged_series)

    merged_df = pd.concat(merged_data, axis=1)
    merged_df.columns = merged_columns
    return merged_df


def normalize_header_name(name: object) -> str:
    text = str(name).strip()
    match = _DUPLICATE_HEADER_PATTERN.match(text)
    if match:
        return match.group(1).strip()
    return text


def normalize_duplicate_headers(columns: list[object]) -> list[str]:
    normalized = []
    raw_names = [str(col).strip() for col in columns]
    for name in raw_names:
        normalized.append(normalize_header_name(name))
    return normalized


def consolidated_headers(columns: list[object]) -> list[str]:
    headers: list[str] = []
    seen: set[str] = set()
    for name in normalize_duplicate_headers(columns):
        if name in seen:
            continue
        seen.add(name)
        headers.append(name)
    return headers


def _merge_cell_values(left: object, right: object) -> str:
    left_text = _normalize_value(left)
    right_text = _normalize_value(right)

    if not left_text and not right_text:
        return ""
    if not left_text:
        return right_text
    if not right_text:
        return left_text
    if right_text in left_text:
        return left_text
    return f"{left_text}, {right_text}"


def _merge_row_values(row: pd.Series) -> str:
    merged = ""
    for value in row.tolist():
        merged = _merge_cell_values(merged, value)
    return merged
