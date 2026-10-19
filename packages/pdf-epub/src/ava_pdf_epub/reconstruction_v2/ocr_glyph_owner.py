"""Whole-owner source eligibility shared by ordinary and separately witnessed layouts."""

from .continuation_presentation_contract import POLICY
from .glyph_owner_structure import glyph_owner_structure
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
    return (
        policy == POLICY
        and not (set(page.risks) - ALLOWED_RISKS)
        and glyph_owner_structure(page, owner, owners)
    )
