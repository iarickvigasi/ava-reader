"""Preserve physical cells and derive exact row/column header targets from observed axes."""

from typing import Any

from .assembly_state import AssemblyState
from .canonical_text import canonical_text
from .segments import Segment


def assemble_table(segment: Segment, state: AssemblyState) -> dict[str, Any]:
    cells = []
    for y, row in enumerate(segment.cells):
        for x, cell in enumerate(row):
            ident = f"{segment.id}-cell{y}-{x}"
            evidence = [{**e, "box": cell.box.model_dump()} for e in state.evidence[segment.id]]
            cells.append(
                dict(
                    id=ident,
                    row=y,
                    column=x,
                    header_axis=cell.header_axis,
                    header_ids=[],
                    style_id=state.style_id(cell.style),
                    evidence=evidence,
                    content=canonical_text(cell.text, cell.spans, None, ident, state),
                )
            )
    for target in cells:
        target["header_ids"] = [
            other["id"]
            for other in cells
            if other["id"] != target["id"]
            and (
                other["header_axis"] in {"column", "both"}
                and other["column"] == target["column"]
                or other["header_axis"] in {"row", "both"}
                and other["row"] == target["row"]
            )
        ]
    return dict(
        row_count=len(segment.cells),
        column_count=len(segment.cells[0]),
        cells=cells,
        caption_id=None,
    )
