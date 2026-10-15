"""Measure a retained label column from exact, uniquely owned native glyph ranges."""

from .native_indent_rows import NativeIndentRows, proven_indent_rows
from .native_line_offsets import native_line_offsets
from .observations import Glyph, PageObservation
from .segments import Segment
from .word_list_markers import word_list_ordinal


def literal_label_geometry(
    segment: Segment, page: PageObservation, proof: NativeIndentRows
) -> tuple[str, float] | None:
    ordinal = word_list_ordinal(segment.text)
    if (
        segment.kind != "list_item"
        or segment.method != "native"
        or ordinal is None
        or not segment.list_ordered
        or segment.list_start != ordinal
        or (segment.style and segment.style.align in {"center", "right"})
    ):
        return None
    rows = proven_indent_rows(segment, proof)
    if not rows:
        return None
    prefix = len(segment.text.split()[0])
    while prefix < len(segment.text) and segment.text[prefix].isspace():
        prefix += 1
    try:
        mappings = native_line_offsets(page, [segment], set(segment.native_line_ids))
    except ValueError:
        return None
    offsets = {m.line_id: m.start for m in mappings}
    label: list[Glyph] = []
    bodies: list[list[Glyph]] = []
    for row in rows:
        cursor = 0
        body: list[Glyph] = []
        for glyph in row.glyphs:
            at = row.text.find(glyph.text, cursor)
            if at < cursor or row.text[cursor:at].strip():
                return None
            cursor = at + len(glyph.text)
            if not glyph.text.strip():
                continue
            start, end = offsets[row.id] + at, offsets[row.id] + cursor
            if start < prefix < end:
                return None  # No invented boundary inside a multi-character glyph.
            (label if end <= prefix else body).append(glyph)
        if row.text[cursor:].strip():
            return None
        if body:
            bodies.append(body)
    if not label or not bodies:
        return None
    all_ink = [*label, *(g for body in bodies for g in body)]
    size = label[0].size
    if size <= 0 or any(abs(g.size - size) > size * 0.05 for g in all_ink):
        return None
    first = bodies[0][0]
    if any(abs(g.box.y0 - first.box.y0) > size * 0.15 for g in label):
        return None
    left, body_x = min(g.box.x0 for g in label), min(g.box.x0 for g in bodies[0])
    if max(g.box.x1 for g in label) >= body_x:
        return None
    if any(abs(min(g.box.x0 for g in body) - body_x) > size * 0.15 for body in bodies):
        return None
    width = (body_x - left) / size
    return (segment.text[:prefix], width) if 0.5 <= width <= 6 else None
