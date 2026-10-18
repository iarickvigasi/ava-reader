"""Current source-backed caller proofs retain the original action and complete glyph ranges."""

from pathlib import Path
from typing import Any

from pypdf import PdfReader

from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget
from .ocr_glyph_frame import glyph_frame_safe
from .ocr_glyph_ranges import ocr_glyph_ranges
from .ocr_layout_caller import ocr_layout_caller
from .ocr_page_label import ocr_page_label_range
from .pdf_link_page import LinkPage


def corroborated_caller_ranges(
    reader: PdfReader,
    target: NavigationTarget,
    annotation: Any,
    caller: Box,
    context: LinkPage,
    policy: str | None,
    source: Path,
) -> list[tuple[str, int, int]]:
    page, owners = context.checkpoint.observation, context.owners
    if not glyph_frame_safe(reader.pages[page.number - 1], page):
        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
    ranges = ocr_glyph_ranges(page, owners, caller, policy)
    if ranges is None:
        ranges = ocr_layout_caller(
            reader,
            target,
            annotation,
            page,
            owners,
            caller,
            policy,
        )
    if ranges is None:
        from .ocr_toc_caller import ocr_toc_caller

        ranges = ocr_toc_caller(
            reader,
            target,
            annotation,
            page,
            owners,
            caller,
            policy,
            source,
        )
    if ranges is None:
        ranges = ocr_page_label_range(
            reader,
            target,
            page,
            owners,
            caller,
            annotation,
            policy,
        )
    if ranges is None:
        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
    return ranges
