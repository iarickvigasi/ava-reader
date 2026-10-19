"""Known ruled-table rectangles forbid dropped blanks, guessed spans and duplicated cells."""

from typing import Any

from ..contracts.source import Box
from .observed_table_grid import observed_table_grid
from .segments import Segment


def _agreement(a: Box, b: Box) -> float:
    intersection = max(0, min(a.x1, b.x1) - max(a.x0, b.x0)) * max(
        0, min(a.y1, b.y1) - max(a.y0, b.y0)
    )
    union = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - intersection
    return intersection / union


def qualify_recognized_tables(evidence: list[dict[str, Any]], segments: list[Segment]) -> None:
    used: set[str] = set()
    for source in evidence:
        box = Box.model_validate(source["box"])
        candidates = [s for s in segments if s.kind == "table" and _agreement(box, s.box) >= 0.8]
        if len(candidates) != 1 or candidates[0].id in used:
            raise ValueError("Recognition omitted or ambiguously mapped a measured table")
        table = candidates[0]
        used.add(table.id)
        actual = observed_table_grid(table.cells)
        expected = source["cells"]
        if len(actual) != len(expected):
            raise ValueError("Recognition changed physical table cell coverage")
        for (row, column, cell), original in zip(actual, expected, strict=True):
            if (row, column, cell.row_span, cell.column_span) != (
                original["row"],
                original["column"],
                original["row_span"],
                original["column_span"],
            ) or _agreement(Box.model_validate(original["box"]), cell.box) < 0.8:
                raise ValueError("Recognition changed measured table origin, span or geometry")
