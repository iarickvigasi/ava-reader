"""Recover merged-cell ownership from measured ruled rectangles, never from text guesses."""

from dataclasses import dataclass

from ..contracts.source import Box
from .observe_tables import TableObservation

# The observation renderer already uses point-space rectangles. Only absorb the
# subpixel differences produced by independent PDF border coordinates.
_EDGE_TOLERANCE_PT = 0.01


@dataclass(frozen=True)
class GridCell:
    row: int
    column: int
    row_span: int
    column_span: int
    box: Box


def _edges(values: list[float]) -> list[float]:
    result: list[float] = []
    for value in sorted(values):
        if not result or value - result[-1] > _EDGE_TOLERANCE_PT:
            result.append(value)
    return result


def _index(edges: list[float], value: float) -> int:
    matches = [i for i, edge in enumerate(edges) if abs(edge - value) <= _EDGE_TOLERANCE_PT]
    if len(matches) != 1:
        raise ValueError("Ambiguous table boundary")
    return matches[0]


def measured_table_grid(table: TableObservation) -> list[GridCell]:
    """Each slot must have exactly one measured owner, including merged headers.

    Missing observation entries are not fabricated empty cells. A real source
    rectangle must cover their slots. Return only cell origins in reading order.
    This geometry qualification does not authorize canonical/export support.
    """
    boxes = [box for row in table.cells for box in row if box is not None]
    if not boxes or len(boxes) > 160:
        raise ValueError("Table cell bound exceeded")
    outer = table.box
    if any(
        box.coordinate_space != outer.coordinate_space
        or not (outer.x0 <= box.x0 < box.x1 <= outer.x1)
        or not (outer.y0 <= box.y0 < box.y1 <= outer.y1)
        for box in boxes
    ):
        raise ValueError("Table cell outside measured bounds")
    xs = _edges([outer.x0, outer.x1, *(v for b in boxes for v in (b.x0, b.x1))])
    ys = _edges([outer.y0, outer.y1, *(v for b in boxes for v in (b.y0, b.y1))])
    columns, rows = len(xs) - 1, len(ys) - 1
    if not 1 <= rows <= 20 or not 1 <= columns <= 8:
        raise ValueError("Table grid bound exceeded")
    owned: set[tuple[int, int]] = set()
    cells = []
    for box in boxes:
        x0, x1 = _index(xs, box.x0), _index(xs, box.x1)
        y0, y1 = _index(ys, box.y0), _index(ys, box.y1)
        slots = {(y, x) for y in range(y0, y1) for x in range(x0, x1)}
        if not slots or owned & slots:
            raise ValueError("Overlapping or degenerate table cells")
        owned.update(slots)
        cells.append(GridCell(y0, x0, y1 - y0, x1 - x0, box))
    if owned != {(y, x) for y in range(rows) for x in range(columns)}:
        raise ValueError("Uncovered table slots")
    return sorted(cells, key=lambda cell: (cell.row, cell.column))
