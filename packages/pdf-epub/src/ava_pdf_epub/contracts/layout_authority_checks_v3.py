"""Every pair/cut/offset matches the original owner and its retained body exactly."""

from .common import unique
from .layout_hyphen_authority_v3 import LayoutHyphenAuthorityV3
from .layout_prefix_cut_v3 import LayoutSourceCut
from .layout_source_cuts_v3 import exact_source_cut_text, source_cut_offset


def validate_owner_authorities(
    original: str,
    source: str,
    cuts: list[LayoutSourceCut],
    role: str,
    source_pdf_sha256: str,
    authorities: list[LayoutHyphenAuthorityV3],
) -> None:
    if exact_source_cut_text(original, cuts, role=role) != source:
        raise ValueError("Normalized owner body differs from its exact structural source cuts")
    if role == "note" and len({c.receipt.label for c in cuts}) > 1:
        raise ValueError("Joined note source cuts have conflicting printed labels")
    unique([a.candidate.id for a in authorities], "layout-hyphen candidate")
    previous = 0
    for supplied in authorities:
        authority = LayoutHyphenAuthorityV3.model_validate(supplied.model_dump())
        candidate, at = authority.candidate, authority.original_source_offset
        end = at + len(authority.pair_source)
        if candidate.role != role or candidate.source_sha256 != source_pdf_sha256:
            raise ValueError("Layout-hyphen authority belongs to another source or role")
        if original[at:end] != authority.pair_source:
            raise ValueError("Layout-hyphen original pair differs from its exact owner slice")
        expected = [
            c.model_copy(
                update={"source_start": c.source_start - at, "source_end": c.source_end - at}
            )
            for c in cuts
            if at <= c.source_start < c.source_end <= end
        ]
        if [c.model_dump() for c in expected] != [c.model_dump() for c in authority.pair_cuts]:
            raise ValueError("Layout-hyphen pair cuts differ from original owner cuts")
        if authority.source_offset != source_cut_offset(at, cuts, len(original)):
            raise ValueError("Layout-hyphen body offset differs from exact source-cut projection")
        retained = authority.retained_pair()
        if source[authority.source_offset : authority.source_offset + len(retained)] != retained:
            raise ValueError("Layout-hyphen retained pair differs from its body owner slice")
        start, finish, _ = authority.body_range()
        if start < previous or not 0 <= start < finish <= len(source):
            raise ValueError("Layout-hyphen body ranges overlap or exceed source")
        previous = finish
