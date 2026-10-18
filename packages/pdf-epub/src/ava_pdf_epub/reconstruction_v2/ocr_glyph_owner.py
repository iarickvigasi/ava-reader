"""Whole-owner source eligibility shared by ordinary and separately witnessed layouts."""

from .continuation_presentation_contract import POLICY
from .geometry import overlap
from .observations import PageObservation
from .segments import Segment

ALLOWED_RISKS = frozenset(
    {
        "language_uncertain",
        "native_spacing_unresolved",
        "native_spacing_unavailable",
        "native_index_layout",
    }
)


def eligible_glyph_owner(
    page: PageObservation, owner: Segment, owners: list[Segment], policy: str | None
) -> bool:
    return not (
        policy != POLICY
        or set(page.risks) - ALLOWED_RISKS
        or page.rotation
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
