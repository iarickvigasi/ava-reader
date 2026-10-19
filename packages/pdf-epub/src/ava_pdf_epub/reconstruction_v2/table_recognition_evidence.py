"""Keep measured merged-cell authority intact when choosing a visual repair task."""

from typing import Any, Literal

from .observe_tables import TableObservation
from .table_grid import measured_table_grid


def table_recognition_evidence(
    page: int, tables: list[TableObservation]
) -> tuple[Literal["ava-prose-region-15", "ava-prose-region-16"], list[dict[str, Any]] | None]:
    try:
        grids = [measured_table_grid(table) for table in tables]
    except ValueError:
        raise ValueError("Essential table exceeds the supported grid profile") from None
    if not any(cell.row_span > 1 or cell.column_span > 1 for grid in grids for cell in grid):
        return "ava-prose-region-15", None
    return "ava-prose-region-16", [
        {
            "box": table.box.model_dump(),
            "cells": [
                {
                    "source_cell_id": f"p{page}-table{index}-cell{cell.row}-{cell.column}",
                    "row": cell.row,
                    "column": cell.column,
                    "row_span": cell.row_span,
                    "column_span": cell.column_span,
                    "box": cell.box.model_dump(),
                }
                for cell in grid
            ],
        }
        for index, (table, grid) in enumerate(zip(tables, grids, strict=True))
    ]
