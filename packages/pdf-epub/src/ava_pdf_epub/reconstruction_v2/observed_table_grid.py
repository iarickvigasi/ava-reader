"""Assign origin-only row cells to a fully covered bounded grid without empty placeholders."""

from .segments import ObservedCell


def observed_table_grid(rows: list[list[ObservedCell]]) -> list[tuple[int, int, ObservedCell]]:
    width = sum(c.column_span for c in rows[0]) if rows else 0
    if not 1 <= len(rows) <= 20 or not 1 <= width <= 8:
        raise ValueError("Table must contain bounded rectangular cells")
    occupied: set[tuple[int, int]] = set()
    output = []
    for y, row in enumerate(rows):
        x = 0
        for cell in row:
            while (y, x) in occupied:
                x += 1
            if y + cell.row_span > len(rows) or x + cell.column_span > width:
                raise ValueError("Observed table span exceeds grid")
            slots = {
                (r, c) for r in range(y, y + cell.row_span) for c in range(x, x + cell.column_span)
            }
            if slots & occupied:
                raise ValueError("Observed table spans overlap")
            occupied.update(slots)
            output.append((y, x, cell))
            x += cell.column_span
    if occupied != {(y, x) for y in range(len(rows)) for x in range(width)}:
        raise ValueError("Observed table has uncovered cells")
    return output
