"""Compare visual ink observations with source font envelopes without changing either."""

from ..contracts.source import Box
from .geometry import area, overlap
from .observations import NativeLine, PageObservation
from .segments import Segment


def ink_envelope_matches(page: PageObservation, line: NativeLine, segment: Segment) -> bool:
    glyphs = [g for g in line.glyphs if g.text.strip()]
    if not glyphs:
        return False
    margin = max(g.size for g in glyphs) / 4
    envelope = Box(
        coordinate_space="page_points_top_left",
        x0=min(g.box.x0 for g in glyphs),
        y0=min(g.box.y0 for g in glyphs),
        x1=max(g.box.x1 for g in glyphs),
        y1=max(g.box.y1 for g in glyphs),
    )
    candidate = Box(
        coordinate_space="page_points_top_left",
        x0=max(0, segment.box.x0 - margin),
        y0=max(0, segment.box.y0 - margin),
        x1=min(page.width_pt, segment.box.x1 + margin),
        y1=min(page.height_pt, segment.box.y1 + margin),
    )
    return (
        bool(overlap(segment.box, envelope))
        and overlap(candidate, envelope) / area(envelope) >= 0.9
    )
