"""Measure body glyphs after the printed prefix; never use the number as a body indent."""

from statistics import median

from .list_markers import MARKER
from .native_indent_rows import NativeIndentRows, proven_indent_rows
from .observations import Glyph, NativeLine
from .segments import Segment


def body_glyphs(line: NativeLine, prefix: int) -> list[Glyph]:
    offset, result = 0, []
    for glyph in line.glyphs:
        at = line.text.find(glyph.text, offset)
        if at < offset or line.text[offset:at].strip():
            return []
        offset = at + len(glyph.text)
        if glyph.text.strip():
            if not glyph.visible or not (
                line.box.x0 <= glyph.box.x0 < glyph.box.x1 <= line.box.x1
                and line.box.y0 <= glyph.box.y0 < glyph.box.y1 <= line.box.y1
            ):
                return []
            if at >= prefix:
                result.append(glyph)
    if line.text[offset:].strip():
        return []
    return result


def list_body_geometry(
    segment: Segment, proof: NativeIndentRows
) -> tuple[float, float, float] | None:
    """Return first-body x, continuation-body x and body font size when all are observed."""
    if segment.method != "native" or not segment.native_line_ids:
        return None
    # Center/right alignment can move a row's start because of its width, not indentation.
    if segment.style is not None and segment.style.align in {"center", "right"}:
        return None
    rows = proven_indent_rows(segment, proof)
    if rows is None:
        return None
    marker, first_marker = MARKER.match(segment.text), MARKER.match(rows[0].text)
    if marker is None or first_marker is None or marker["marker"] != first_marker["marker"]:
        return None
    if not segment.text.startswith(rows[0].text.rstrip()):
        return None
    first = body_glyphs(rows[0], first_marker.end())
    following = [body_glyphs(row, 0) for row in rows[1:]]
    if not first or any(not glyphs for glyphs in following):
        return None
    all_body = [*first, *(glyph for row in following for glyph in row)]
    # Mixed body sizes do not establish one reliable physical-em scale.
    size = median(g.size for g in all_body)
    if max(g.size for g in all_body) - min(g.size for g in all_body) > size * 0.05:
        return None
    first_x = min(g.box.x0 for g in first)
    margins = [min(g.box.x0 for g in row) for row in following]
    body_x = median(margins) if margins else first_x
    if any(abs(x - body_x) > size * 0.15 for x in margins):
        return None
    return first_x, body_x, size
