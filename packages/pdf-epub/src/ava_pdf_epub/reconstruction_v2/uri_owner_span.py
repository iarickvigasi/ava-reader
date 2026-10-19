"""Map one unique exact URI span; layout whitespace is allowed only at source row breaks."""

import re

from .geometry import overlap
from .observations import PageObservation
from .ocr_glyph_fragments import source_fragments
from .ocr_glyph_owner import eligible_glyph_owner
from .segments import Segment
from .uri_group_types import UriOwnerSpan, UriSourcePart
from .uri_text_boundary import uri_boundary_after, uri_boundary_before


def uri_owner_span(
    page: PageObservation,
    owners: list[Segment],
    parts: list[UriSourcePart],
    current_index: int,
    policy: str | None,
) -> UriOwnerSpan | None:
    if sum(len(s.text) for s in owners) > 2000000:
        return None
    pattern = re.compile(r"\s*".join("(" + re.escape(p.text) + ")" for p in parts))
    candidates = []
    glyphs = [g for p in parts for _, g in p.values]
    for owner in owners:
        if not eligible_glyph_owner(page, owner, owners, policy):
            continue
        fragments = source_fragments(page, owner)
        keys = (
            {(line.id, i) for line, values in fragments for i, _ in values} if fragments else set()
        )
        if any((part.line.id, i) not in keys for part in parts for i, _ in part.values):
            continue
        if any(
            other is not owner and any(overlap(g.box, other.box) for g in glyphs)
            for other in owners
        ):
            continue
        for match in pattern.finditer(owner.text):
            if not uri_boundary_before(owner.text, match.start()) or not uri_boundary_after(
                owner.text, match.end()
            ):
                continue
            ranges = tuple(
                (owner.id, *match.span(i + 1))
                for i, part in enumerate(parts)
                if part.annotation_index == current_index
            )
            if ranges:
                candidates.append(UriOwnerSpan(owner, match.start(), match.end(), ranges))
                if len(candidates) > 1:
                    return None
    return candidates[0] if len(candidates) == 1 else None
