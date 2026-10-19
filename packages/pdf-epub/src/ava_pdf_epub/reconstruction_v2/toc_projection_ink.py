"""A complete visible source page, without furniture or other ink exemptions."""

from .geometry import area
from .native_line_visibility import complete_visible_line
from .observations import PageObservation
from .ocr_glyph_fragments import Fragment


def toc_projection_ink(page: PageObservation) -> list[Fragment] | None:
    if not page.lines or len({line.id for line in page.lines}) != len(page.lines):
        return None
    fragments = []
    seen = set()
    for line in page.lines:
        if not complete_visible_line(line):
            return None
        selected = [(i, g) for i, g in enumerate(line.glyphs) if g.text.strip()]
        for _, glyph in selected:
            key = (glyph.text, glyph.box.x0, glyph.box.y0, glyph.box.x1, glyph.box.y1)
            if (
                key in seen
                or not glyph.visible
                or glyph.source_artifact
                or area(glyph.box) <= 0
                or not glyph.box.within(page.width_pt, page.height_pt)
                or "\ufffd" in glyph.text
                or "(cid:" in glyph.text
            ):
                return None
            seen.add(key)
        if selected:
            fragments.append((line, selected))
    return fragments if 0 < len(seen) <= 20000 else None
