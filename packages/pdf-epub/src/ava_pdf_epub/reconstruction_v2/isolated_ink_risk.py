"""An ink-risk witness must lie wholly outside the selected owner's source lines."""

from .geometry import area, overlap, union
from .observations import PageObservation
from .ocr_glyph_owner import ALLOWED_RISKS
from .segments import Segment

INK_RISK = "glyph_without_visible_ink"


def isolated_ink_risk(page: PageObservation, owner: Segment) -> bool:
    if set(page.risks) - ALLOWED_RISKS != {INK_RISK}:
        return False
    margin = max(
        (g.size / 4 for line in page.lines for g in line.glyphs if overlap(g.box, owner.box)),
        default=0,
    )
    protected = owner.box.model_copy(
        update={
            "x0": max(0, owner.box.x0 - margin),
            "y0": max(0, owner.box.y0 - margin),
            "x1": min(page.width_pt, owner.box.x1 + margin),
            "y1": min(page.height_pt, owner.box.y1 + margin),
        }
    )
    witnesses = 0
    for line in page.lines:
        for glyph in line.glyphs:
            if glyph.visible:
                continue
            witnesses += 1
            if (
                not glyph.text.strip()
                or glyph.source_artifact
                or area(glyph.box) <= 0
                or not glyph.box.within(page.width_pt, page.height_pt)
                or not line.box.within(page.width_pt, page.height_pt)
                or any(not g.box.within(page.width_pt, page.height_pt) for g in line.glyphs)
                or overlap(union([line.box, *(g.box for g in line.glyphs)]), protected)
                or overlap(glyph.box, protected)
            ):
                return False
    return witnesses > 0
