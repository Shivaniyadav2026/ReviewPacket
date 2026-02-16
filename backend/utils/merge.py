from __future__ import annotations

import pandas as pd
import re


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
    normalized_columns = _normalize_duplicate_headers(columns)
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

        # Merge duplicate columns by concatenating non-empty values
        merged_series = df.iloc[:, duplicate_indices[0]].copy()
        for col_index in duplicate_indices[1:]:
            next_series = df.iloc[:, col_index]
            merged_series = merged_series.combine(
                next_series,
                lambda left, right: _merge_cell_values(left, right),
            )

        merged_columns.append(name)
        merged_data.append(merged_series)

    merged_df = pd.concat(merged_data, axis=1)
    merged_df.columns = merged_columns
    return merged_df


def _normalize_duplicate_headers(columns: list[object]) -> list[str]:
    normalized = []
    raw_names = [str(col).strip() for col in columns]
    base_set = set(raw_names)
    pattern = re.compile(r"^(.*)\\.(\\d+)$")
    for name in raw_names:
        match = pattern.match(name)
        if match and match.group(1) in base_set:
            normalized.append(match.group(1))
        else:
            normalized.append(name)
    return normalized


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
    return f"{left_text} | {right_text}"
