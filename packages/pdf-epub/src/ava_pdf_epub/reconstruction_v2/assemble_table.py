"""Preserve physical cells and derive exact row/column header targets from observed axes."""

from typing import Any

from ..contracts.blocks import TableCell
from ..contracts.table_coverage import header_covers
from .assembly_state import AssemblyState
from .canonical_text import canonical_text
from .observed_table_grid import observed_table_grid
from .segments import Segment


def assemble_table(segment: Segment, state: AssemblyState) -> dict[str, Any]:
    cells = []
    for y, x, cell in observed_table_grid(segment.cells):
        ident = f"{segment.id}-cell{y}-{x}"
        evidence = [{**e, "box": cell.box.model_dump()} for e in state.evidence[segment.id]]
        cells.append(
            dict(
                id=ident,
                row=y,
                row_span=cell.row_span,
                column_span=cell.column_span,
                column=x,
                header_axis=cell.header_axis,
                header_ids=[],
                style_id=state.style_id(cell.style),
                evidence=evidence,
                content=canonical_text(cell.text, cell.spans, None, ident, state),
            )
        )
    positioned = [TableCell.model_validate(cell) for cell in cells]
    for target, model in zip(cells, positioned, strict=True):
        target["header_ids"] = [
            other.id for other in positioned if other.id != model.id and header_covers(other, model)
        ]
    return dict(
        row_count=len(segment.cells),
        column_count=sum(cell.column_span for cell in segment.cells[0]),
        cells=cells,
        caption_id=None,
    )
