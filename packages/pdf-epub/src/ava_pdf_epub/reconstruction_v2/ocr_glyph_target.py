"""Choose the first covered physical fragment before proving its OCR destination."""

from pypdf import PdfReader

from ..pdf_navigation import NavigationTarget
from .geometry import overlap, union
from .numbered_heading_map import numbered_heading_map
from .observations import NativeLine, PageObservation
from .ocr_glyph_map import prove_glyph_map
from .segments import Segment
from .visible_target_glyph_map import visible_target_glyph_map


def ocr_glyph_target(
    page: PageObservation,
    line: NativeLine,
    owners: list[Segment],
    left: float,
    top: float,
    policy: str | None,
    *,
    excluded_ids: frozenset[str] = frozenset(),
    reader: PdfReader | None = None,
    source_target: NavigationTarget | None = None,
) -> tuple[str, int] | None:
    groups: list[tuple[tuple[int, ...], list[int]]] = []
    for ordinal, glyph in enumerate(line.glyphs):
        if not glyph.text.strip():
            continue
        candidates = tuple(
            i
            for i, owner in enumerate(owners)
            if owner.id not in excluded_ids and overlap(glyph.box, owner.box)
        )
        if groups and groups[-1][0] == candidates:
            groups[-1][1].append(ordinal)
        else:
            groups.append((candidates, [ordinal]))
    for candidates, ordinals in groups:
        box = union([line.glyphs[i].box for i in ordinals])
        if not candidates or box.x1 < left or box.y1 < top:
            continue
        # Never skip a covered first fragment because another string maps more easily.
        if len(candidates) != 1:
            raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
        owner = owners[candidates[0]]
        proof = prove_glyph_map(page, owner, owners, policy)
        if proof is None and reader is not None and source_target is not None:
            proof = visible_target_glyph_map(reader, source_target, page, owner, owners, policy)
            if proof is None:
                proof = numbered_heading_map(reader, source_target, page, owner, owners, policy)
        if proof is None:
            raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
        mapped = [g for g in proof.glyphs if g.line_id == line.id and g.ordinal in ordinals]
        if len(mapped) != len(ordinals):
            raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
        return owner.id, mapped[0].start
    return None
