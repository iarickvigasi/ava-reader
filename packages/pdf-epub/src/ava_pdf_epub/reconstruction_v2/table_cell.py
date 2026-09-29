"""Keep exact native inline styles when several physical lines occupy a table cell."""

from ..contracts.source import Box
from .line_spans import line_spans
from .observations import NativeLine
from .segments import ObservedCell, ObservedSpan


def table_cell(lines: list[NativeLine], box: Box) -> ObservedCell:
    lines = sorted(lines, key=lambda line: (line.box.y0, line.box.x0))
    spans: list[ObservedSpan] = []
    offset = 0
    for line in lines:
        spans.extend(
            span.model_copy(update={"start": span.start + offset, "end": span.end + offset})
            for span in line_spans(line)
        )
        offset += len(line.text) + 1
    return ObservedCell(
        text=" ".join(line.text for line in lines),
        box=box,
        style=lines[0].style if lines else None,
        spans=spans,
    )
