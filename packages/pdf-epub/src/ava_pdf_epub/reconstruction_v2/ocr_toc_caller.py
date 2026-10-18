"""A separately witnessed TOC row can contain ordinal/title and right-folio tab slots."""

from pathlib import Path
from typing import Any

from pypdf import PdfReader

from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget
from .continuation_presentation_contract import POLICY
from .geometry import area, overlap
from .glyph_caller_ranges import glyph_caller_ranges
from .observations import PageObservation
from .ocr_glyph_fragments import source_fragments
from .ocr_glyph_frame import glyph_frame_safe
from .ocr_glyph_owner import eligible_glyph_owner
from .ocr_literal_glyph_map import literal_fragment_map
from .page_label_semantics import source_destination
from .segments import Segment
from .toc_outline_match import toc_outline_match
from .toc_page_label import toc_page_label
from .toc_row_layout import toc_row_layout
from .toc_source_rows import toc_source_rows


def ocr_toc_caller(
    reader: PdfReader,
    target: NavigationTarget,
    annotation: Any,
    page: PageObservation,
    owners: list[Segment],
    caller: Box,
    policy: str | None,
    source: Path,
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
    label = toc_page_label(reader, target.page)
    rows = toc_source_rows(reader, page) if label else set()
    if label is None or not rows:
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
        if not any(overlap(g.box, owner.box) for _, _, g in touched) or not eligible_glyph_owner(
            page, owner, owners, policy
        ):
            continue
        fragments = source_fragments(page, owner)
        if fragments is None:
            continue
        layout = toc_row_layout(page, fragments, label)
        if (
            layout is None
            or layout.folio.id not in rows
            or not toc_outline_match(source, layout.title, target.page, layout.ordinal)
        ):
            continue
        proof = literal_fragment_map(page, owner, owners, fragments)
        if proof is not None:
            proofs.append(proof)
    return glyph_caller_ranges(touched, proofs, caller)
