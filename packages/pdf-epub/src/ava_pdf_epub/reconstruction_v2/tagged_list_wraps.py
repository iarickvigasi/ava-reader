"""Join only checked same-page list-body display wraps; retain exact glyph spans and rows."""

from statistics import median

from .font_style import glyph_traits
from .list_markers import MARKER
from .observations import Glyph, NativeLine, PageObservation
from .paragraphs import _join
from .reading_order import Placement


def _body_glyphs(line: NativeLine, prefix: int) -> list[Glyph]:
    result = []
    offset = 0
    for glyph in line.glyphs:
        at = line.text.find(glyph.text, offset)
        if at < offset:
            return []
        offset = at + len(glyph.text)
        if at >= prefix and glyph.text.strip():
            result.append(glyph)
    return result


def join_tagged_list_wraps(ordered: list[Placement], page: PageObservation) -> list[Placement]:
    lines = {line.id: line for line in page.lines}
    output: list[Placement] = []
    for current in ordered:
        previous = output[-1] if output else None
        if previous and _compatible(previous, current, lines):
            output[-1] = Placement(
                _join(previous.segment, current.segment), previous.band, previous.column
            )
        else:
            output.append(current)
    return output


def _compatible(a: Placement, b: Placement, lines: dict[str, NativeLine]) -> bool:
    left, right = a.segment, b.segment
    if (
        left.kind != "list_item"
        or right.kind != "paragraph"
        or left.method != "native"
        or right.method != "native"
        or left.page != right.page
        or a.column != b.column
        or (a.column and a.band != b.band)
        or right.structure_candidate
        or left.preserve_line_breaks
        or right.preserve_line_breaks
        or not left.native_line_ids
        or len(right.native_line_ids) != 1
        or any(i not in lines for i in [*left.native_line_ids, *right.native_line_ids])
    ):
        return False
    first, tail, following = (
        lines[left.native_line_ids[0]],
        lines[left.native_line_ids[-1]],
        lines[right.native_line_ids[0]],
    )
    match = MARKER.match(first.text)
    if match is None:
        return False
    body = _body_glyphs(first, match.end())
    next_body = _body_glyphs(following, 0)
    observed = [
        *body,
        *[g for i in left.native_line_ids[1:] for g in lines[i].glyphs if g.text.strip()],
        *next_body,
    ]
    mcids = {g.list_body_mcid for g in observed}
    all_ink = [
        g
        for i in [*left.native_line_ids, *right.native_line_ids]
        for g in lines[i].glyphs
        if g.text.strip()
    ]
    # Printed labels can live outside the LBody namespace (e.g. Lbl/Artifact).
    # Their visibility/geometry and spans remain conserved; only body glyphs
    # establish the shared semantic list-body identity.
    if (
        not body
        or not next_body
        or len(mcids) != 1
        or None in mcids
        or not all(g.visible for g in all_ink)
    ):
        return False
    size = median(g.size for g in [*body, *next_body])
    # A real hanging body begins after the printed label; same MCID alone cannot
    # join ordinary new paragraphs, another numbered item, columns or wide gaps.
    if (
        body[0].box.x0 <= first.box.x0 + size * 0.5
        or abs(next_body[0].box.x0 - body[0].box.x0) > size * 0.5
        or not 0 <= following.box.y0 - tail.box.y1 <= size * 1.2
        or max(g.size for g in [*body, *next_body]) - min(g.size for g in [*body, *next_body])
        > size * 0.05
        or len({glyph_traits(g).family for g in [*body, *next_body]}) != 1
    ):
        return False
    return True
