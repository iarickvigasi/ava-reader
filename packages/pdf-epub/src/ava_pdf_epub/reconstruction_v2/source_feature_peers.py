"""Optional peers never enlarge a source column or clip a complete source line group."""

from ..contracts.source import Box
from .segments import Segment
from .source_feature_geometry import same_column


def optional_heading_peer(target: Segment, segments: list[Segment], column: Box) -> Segment | None:
    if target.kind != "heading":
        return None
    peers = [
        s
        for s in segments
        if s.id != target.id
        and s.kind == "heading"
        and s.method == "ocr"
        and same_column(target, s)
        and column.x0 <= s.box.x0 < s.box.x1 <= column.x1
    ]
    return min(peers, key=lambda s: (abs(s.box.y0 - target.box.y0), s.id)) if peers else None
