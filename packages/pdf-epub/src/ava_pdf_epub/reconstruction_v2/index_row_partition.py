"""Match complete literal rows uniquely, then require an ordered whole-body partition."""

from .index_projection_types import IndexSourceRow
from .segments import Segment


def index_row_partition(
    rows: list[IndexSourceRow], owners: list[Segment]
) -> list[tuple[Segment, tuple[IndexSourceRow, ...]]] | None:
    parts = ["".join(c for c in row.text if not c.isspace()) for row in rows]
    offsets = [0]
    for part in parts:
        offsets.append(offsets[-1] + len(part))
    if not all(parts) or offsets[-1] > 200000:
        return None
    source = "".join(parts)
    starts, ends = (
        {offset: i for i, offset in enumerate(offsets[:-1])},
        {offset: i + 1 for i, offset in enumerate(offsets[1:])},
    )
    result, cursor = [], 0
    for owner in owners:
        text = "".join(c for c in owner.text if not c.isspace())
        if not text:
            return None
        matches, at = [], source.find(text)
        while at >= 0:
            if at in starts and at + len(text) in ends:
                start, end = starts[at], ends[at + len(text)]
                if end - start <= 64 and rows[start].column == rows[end - 1].column:
                    matches.append((start, end))
                    if len(matches) > 1:
                        return None
            at = source.find(text, at + 1)
        if len(matches) != 1 or matches[0][0] != cursor:
            return None
        start, cursor = matches[0]
        selected = tuple(rows[start:cursor])
        if any(
            not 0 <= b.box.y0 - a.box.y1 <= min(a.size, b.size) * 2
            for a, b in zip(selected, selected[1:], strict=False)
        ):
            return None
        result.append((owner, selected))
    return result if cursor == len(rows) and result else None
