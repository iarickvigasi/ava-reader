"""Span-aware cell coverage and source-declared row/column header relationships."""

from typing import Literal, Protocol


class PositionedCell(Protocol):
    row: int
    column: int
    row_span: int
    column_span: int
    header_axis: Literal["row", "column", "both"] | None


def header_covers(header: PositionedCell, cell: PositionedCell) -> bool:
    column_overlap = max(header.column, cell.column) < min(
        header.column + header.column_span, cell.column + cell.column_span
    )
    row_overlap = max(header.row, cell.row) < min(
        header.row + header.row_span, cell.row + cell.row_span
    )
    return (
        header.header_axis in {"column", "both"}
        and column_overlap
        and header.row <= cell.row
        or header.header_axis in {"row", "both"}
        and row_overlap
        and header.column <= cell.column
    )


def covered_slots(cell: PositionedCell, rows: int, columns: int) -> set[tuple[int, int]]:
    if cell.row + cell.row_span > rows or cell.column + cell.column_span > columns:
        raise ValueError("Table span outside declared grid")
    return {
        (row, column)
        for row in range(cell.row, cell.row + cell.row_span)
        for column in range(cell.column, cell.column + cell.column_span)
    }
