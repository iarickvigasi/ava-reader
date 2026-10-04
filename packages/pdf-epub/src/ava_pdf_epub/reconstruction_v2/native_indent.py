"""Measure first-line displacement separately from a source-qualified paragraph body inset."""

from statistics import median

from .observations import NativeLine, PageObservation
from .segments import Segment


def paragraph_margin(lines: list[NativeLine], size: float, literal: bool = False) -> float | None:
    if len(lines) < 2:
        return None
    margins = [line.box.x0 for line in (lines if literal else lines[1:])]
    value = median(margins)
    return value if all(abs(x - value) <= size * 0.15 for x in margins) else None


def native_indent(
    page: PageObservation,
    segments: list[Segment],
    columns: dict[str, tuple[int, int]],
    segment: Segment,
    lines: list[NativeLine],
    size: float,
) -> tuple[float | None, float | None]:
    lookup = {line.id: line for line in page.lines}
    band, column = columns[segment.id]
    two_columns = any(col for _, col in columns.values())
    margins = []
    for other in segments:
        if other.id == segment.id or other.kind != "paragraph":
            continue
        other_band, other_column = columns[other.id]
        if other_column != column or (two_columns and other_band != band):
            continue
        rows = [lookup[i] for i in other.native_line_ids if i in lookup]
        margin = paragraph_margin(rows, size, other.preserve_line_breaks)
        if margin is not None:
            margins.append(margin)
    local = min(margins) if margins else None
    literal = segment.preserve_line_breaks or segment.kind in {"code", "verse"}
    body = paragraph_margin(lines, size, literal)
    first = lines[0].box.x0
    if body is None:
        if len(lines) == 1 and not literal and local is not None:
            shift = (first - local) / size
            if abs(shift) <= 0.15:
                return 0.0, None
            # Retain the bounded, existing italic-offset quote cue without
            # claiming that one physical line reveals a paragraph first indent.
            if segment.style and segment.style.italic and 1.2 <= shift <= 6:
                return None, shift
        return None, None
    delta = (first - body) / size
    indent = delta if -3 <= delta <= 6 else None
    # A hanging first line supplies the physical outer edge required to keep
    # negative displacement inside the source block, even without neighbouring prose.
    if indent is not None and indent < 0 and local is None:
        local = min(line.box.x0 for line in lines)
    inset = (body - local) / size if local is not None else None
    block = inset if inset is not None and 0.5 <= inset <= 6 else None
    return indent, block
