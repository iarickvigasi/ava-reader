"""Record actual ruled-cell geometry before interpreting text as prose or list markers."""

from typing import Any

from pydantic import Field

from ..contracts.common import Record
from ..contracts.source import Box
from .geometry import rectangle
from .observations import NativeLine


class TableObservation(Record):
    box: Box
    cells: list[list[Box | None]] = Field(max_length=500)
    line_ids: list[str] = Field(max_length=10000)


def observe_tables(
    page: Any, lines: list[NativeLine], bounds: tuple[float, float, float, float]
) -> list[TableObservation]:
    left, top, right, bottom = bounds
    width, height = right - left, bottom - top
    tables = page.find_tables()
    if len(tables) > 100:
        raise ValueError("Page table bound exceeded")
    result = []
    for table in tables:

        def box(values: tuple[float, float, float, float]) -> Box:
            x0, y0, x1, y1 = values
            return rectangle((x0 - left, y0 - top, x1 - left, y1 - top), width, height)

        outer = box(table.bbox)
        cells = [[box(cell) if cell else None for cell in row.cells] for row in table.rows]
        ids = [
            line.id
            for line in lines
            if outer.x0 <= line.box.x0 <= line.box.x1 <= outer.x1
            and outer.y0 <= line.box.y0 <= line.box.y1 <= outer.y1
        ]
        result.append(TableObservation(box=outer, cells=cells, line_ids=ids))
    return result
