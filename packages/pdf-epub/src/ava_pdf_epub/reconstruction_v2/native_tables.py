"""Rectangular source cells retain their text, styles and explicit header associations."""

from .geometry import overlap
from .observations import PageObservation
from .observe_tables import TableObservation
from .segments import ObservedCell, Segment
from .table_cell import table_cell


def native_tables(page: PageObservation, tables: list[TableObservation]) -> list[Segment]:
    output = []
    for index, table in enumerate(tables):
        ident = f"p{page.number}-table{index}"
        rows = table.cells
        invalid = (
            not rows
            or len(rows) > 20
            or len(rows[0]) > 8
            or any(len(row) != len(rows[0]) or any(c is None for c in row) for row in rows)
        )
        if invalid:
            output.append(
                Segment(
                    id=ident,
                    page=page.number,
                    box=table.box,
                    kind="unsupported",
                    text="Table is not a supported rectangular grid",
                    method="native",
                )
            )
            continue
        cells: list[list[ObservedCell]] = []
        for source_row in rows:
            values = []
            for box in source_row:
                assert box is not None
                lines = [line for line in page.lines if overlap(box, line.box) > 0]
                values.append(table_cell(lines, box))
            cells.append(values)
        top_headers = all(c.style and c.style.bold for c in cells[0])
        side_headers = len(cells) > 1 and all(
            row[0].style and row[0].style.bold for row in cells[1:]
        )
        if not top_headers and not side_headers:
            output.append(
                Segment(
                    id=ident,
                    page=page.number,
                    box=table.box,
                    kind="unsupported",
                    text="Table header relationship requires source review",
                    method="native",
                )
            )
            continue
        for y, row in enumerate(cells):
            for x, cell in enumerate(row):
                axis = (
                    "both"
                    if top_headers and side_headers and x == y == 0
                    else (
                        "column"
                        if top_headers and y == 0
                        else "row"
                        if side_headers and x == 0
                        else None
                    )
                )
                row[x] = ObservedCell.model_validate({**cell.model_dump(), "header_axis": axis})
        output.append(
            Segment(
                id=ident,
                page=page.number,
                box=table.box,
                kind="table",
                cells=cells,
                native_line_ids=table.line_ids,
                method="native",
            )
        )
    return output
