"""Original source actions can select a complete intrinsically witnessed chapter heading."""

from typing import Any

from pypdf import PdfReader

from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget
from .continuation_presentation_contract import POLICY
from .geometry import area, overlap
from .glyph_caller_ranges import glyph_caller_ranges
from .observations import PageObservation
from .ocr_glyph_frame import glyph_frame_safe
from .ocr_glyph_map import prove_glyph_map
from .page_label_semantics import source_destination
from .segments import Segment
from .source_numbered_heading_map import source_numbered_heading_map
from .source_visible_glyph_map import source_visible_glyph_map


def ocr_layout_caller(
    reader: PdfReader,
    target: NavigationTarget,
    annotation: Any,
    page: PageObservation,
    owners: list[Segment],
    caller: Box,
    policy: str | None,
) -> list[tuple[str, int, int]] | None:
    if (
        policy != POLICY
        or target.page is None
        or target.url is not None
        or not caller.within(page.width_pt, page.height_pt)
        or not glyph_frame_safe(reader.pages[page.number - 1], page)
        or not source_destination(reader, annotation, target)
    ):
        return None
    touched = [
        (line.id, i, glyph)
        for line in page.lines
        for i, glyph in enumerate(line.glyphs)
        if glyph.text.strip()
        and (area(glyph.box) <= 0 or overlap(glyph.box, caller) / area(glyph.box) > 0.05)
    ]
    if not touched or len(touched) > 20000:
        return None
    proofs = []
    for owner in owners:
        if not any(overlap(g.box, owner.box) for _, _, g in touched):
            continue
        proof = prove_glyph_map(page, owner, owners, policy)
        if proof is None:
            proof = source_numbered_heading_map(reader, page, owner, owners, policy)
        if proof is None:
            proof = source_visible_glyph_map(reader, page, owner, owners, policy)
        if proof is not None:
            proofs.append(proof)
    return glyph_caller_ranges(touched, proofs, caller)
