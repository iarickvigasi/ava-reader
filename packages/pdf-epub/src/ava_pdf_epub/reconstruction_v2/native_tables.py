"""Rectangular source cells retain their text, styles and explicit header associations."""

from .geometry import overlap
from .native_review import NativeReviewRequired
from .observations import PageObservation
from .observe_tables import TableObservation
from .segments import ObservedCell, Segment
from .table_cell import table_cell
from .table_grid import GridCell, measured_table_grid


def native_tables(page: PageObservation, tables: list[TableObservation]) -> list[Segment]:
    output = []
    for index, table in enumerate(tables):
        ident = f"p{page.number}-table{index}"
        if table.ruled:
            grid = measured_table_grid(table)
        else:
            # This separately qualified borderless pattern has spaces between
            # physical rows. Those spaces are not logical empty rows or merges.
            if not table.cells or len(table.cells) > 20 or not 1 <= len(table.cells[0]) <= 8:
                raise ValueError("Essential table exceeds the supported grid profile")
            if any(len(row) != len(table.cells[0]) or None in row for row in table.cells):
                raise ValueError("Ambiguous borderless table cells")
            grid = [
                GridCell(y, x, 1, 1, box)
                for y, row in enumerate(table.cells)
                for x, box in enumerate(row)
                if box is not None
            ]
        row_count = max(c.row + c.row_span for c in grid)
        cells: list[list[ObservedCell]] = [[] for _ in range(row_count)]
        merged = any(c.row_span > 1 or c.column_span > 1 for c in grid)
        for origin in grid:
            box = origin.box
            lines = [line for line in page.lines if overlap(box, line.box) > 0]
            if any(
                not (
                    box.x0 <= line.box.x0 < line.box.x1 <= box.x1
                    and box.y0 <= line.box.y0 < line.box.y1 <= box.y1
                )
                for line in lines
            ):
                raise NativeReviewRequired("Table text crosses physical cell boundaries")
            cell = table_cell(lines, box).model_copy(
                update={"row_span": origin.row_span, "column_span": origin.column_span}
            )
            cells[origin.row].append(cell)
        header_rows = 0
        if merged:
            for row in cells:
                visible = [c for c in row if c.text.strip()]
                if not visible or not all(c.style and c.style.bold for c in visible):
                    break
                header_rows += 1
        top_headers = all(c.style and c.style.bold for c in cells[0])
        if not merged:
            header_rows = int(top_headers)
        top_headers = header_rows > 0
        side_headers = header_rows < len(cells) and all(
            row and row[0].style and row[0].style.bold for row in cells[header_rows:]
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
                        if top_headers and y < header_rows and cell.text.strip()
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
