"""Frame, identity and competing-region guards independent of a risk witness."""

from .geometry import overlap
from .observations import PageObservation
from .segments import Segment


def glyph_owner_structure(page: PageObservation, owner: Segment, owners: list[Segment]) -> bool:
    return not (
        page.rotation
        or owner.method != "ocr"
        or owner.native_line_ids
        or owner.kind in {"table", "figure", "furniture", "unsupported"}
        or owner.source_marginal_furniture
        or owner.page != page.number
        or not owner.box.within(page.width_pt, page.height_pt)
        or not 0 < len(owner.text) <= 200000
        or len({s.id for s in owners}) != len(owners)
        or sum(s is owner for s in owners) != 1
        or len({line.id for line in page.lines}) != len(page.lines)
        or any(overlap(r.box, owner.box) for r in page.required_regions)
        or any(overlap(g.box, owner.box) for g in page.graphics)
    )
