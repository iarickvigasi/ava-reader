"""Select every physical source glyph in an owner before consulting accepted text."""

from .geometry import area, overlap
from .native_line_visibility import complete_visible_line
from .observations import Glyph, NativeLine, PageObservation
from .segments import Segment

Fragment = tuple[NativeLine, list[tuple[int, Glyph]]]


def source_fragments(page: PageObservation, owner: Segment) -> list[Fragment] | None:
    fragments: list[Fragment] = []
    count = 0
    for line in page.lines:
        selected = [
            (i, g)
            for i, g in enumerate(line.glyphs)
            if g.text.strip() and overlap(g.box, owner.box)
        ]
        if not selected:
            continue
        count += len(selected)
        if count > 20000 or not complete_visible_line(line):
            return None
        first, last = selected[0][0], selected[-1][0]
        if any(
            g.text.strip() and not overlap(g.box, owner.box) for g in line.glyphs[first : last + 1]
        ):
            return None
        for _, glyph in selected:
            margin = glyph.size / 4
            expanded = owner.box.model_copy(
                update={
                    "x0": max(0, owner.box.x0 - margin),
                    "x1": min(page.width_pt, owner.box.x1 + margin),
                    "y0": max(0, owner.box.y0 - margin),
                    "y1": min(page.height_pt, owner.box.y1 + margin),
                }
            )
            if (
                not glyph.visible
                or glyph.source_artifact
                or area(glyph.box) <= 0
                or not glyph.box.within(page.width_pt, page.height_pt)
                or overlap(glyph.box, expanded) / area(glyph.box) < 0.9
                or "\ufffd" in glyph.text
                or "(cid:" in glyph.text
            ):
                return None
        fragments.append((line, selected))
    return fragments if fragments and len(fragments) <= 64 else None
