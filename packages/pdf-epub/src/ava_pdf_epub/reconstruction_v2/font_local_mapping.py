"""External unmapped glyphs do not invalidate a separately proved complete local font run."""

from typing import Any

from pypdf import PdfReader

from .font_mapping_source import direct_type1_mapping
from .geometry import overlap
from .native_line_visibility import complete_visible_line
from .observations import NativeLine, PageObservation
from .segments import Segment


def local_font_mapping(
    source_page: Any,
    reader: PdfReader,
    page: PageObservation,
    lines: list[NativeLine],
    owner: Segment,
    segments: list[Segment],
) -> bool:
    if (
        set(page.risks) - {"unreliable_glyph_mapping", "language_uncertain"}
        or not direct_type1_mapping(source_page, reader)
        or not lines
        or any(not complete_visible_line(line) for line in lines)
    ):
        return False
    selected = {line.id for line in lines}
    bad = [
        line
        for line in page.lines
        if any("(cid:" in g.text or "\ufffd" in g.text for g in line.glyphs)
    ]
    if not bad or any(line.id in selected for line in bad):
        return False  # A bare risk flag is not proof that its cause is elsewhere.
    for line in lines:
        if any(
            g.source_artifact or not g.visible or "(cid:" in g.text or "\ufffd" in g.text
            for g in line.glyphs
        ):
            return False
    if any(
        g.text.strip() and overlap(g.box, owner.box)
        for line in page.lines
        if line.id not in selected
        for g in line.glyphs
    ):
        return False
    if any(
        s.id != owner.id
        and s.page == page.number
        and s.text
        and any(g.text.strip() and overlap(g.box, s.box) for line in lines for g in line.glyphs)
        for s in segments
    ):
        return False
    return True
