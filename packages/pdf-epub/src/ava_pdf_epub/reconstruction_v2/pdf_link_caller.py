"""Caller selection for one original PDF action; source and OCR guards stay unchanged."""

from pathlib import Path
from typing import Any

from pypdf import PdfReader

from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget
from .assembly_state import AssemblyState
from .geometry import overlap
from .native_link_resolution import NativeLinkResolution
from .pdf_glyph_ranges import glyph_ranges
from .pdf_link_page import LinkPage
from .pdf_native_caller import native_pdf_caller
from .pdf_ocr_caller import ocr_pdf_caller


def pdf_link_caller(
    reader: PdfReader,
    target: NavigationTarget,
    annotation: Any,
    rect: Box,
    context: LinkPage,
    state: AssemblyState,
    scratch: Path | None,
    source: Path,
    resolution: NativeLinkResolution,
) -> list[tuple[str, int, int]]:
    native = any(
        overlap(line.box, rect) and any(line.id in s.native_line_ids for s in context.owners)
        for line in context.checkpoint.observation.lines
    )
    if native and any(
        s.method == "ocr" and s.text and overlap(s.box, rect) for s in context.owners
    ):
        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
    if native:
        try:
            ranges = glyph_ranges(
                context.checkpoint.observation,
                context.owners,
                rect,
                source_line_maps=state.native_line_maps,
            )
        except ValueError as error:
            if str(error) != "PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW" or scratch is None:
                raise
            ranges = native_pdf_caller(
                reader,
                target,
                annotation,
                rect,
                context,
                state,
                scratch,
                resolution,
            )
    else:
        ranges = ocr_pdf_caller(reader, target, annotation, rect, context, state, scratch, source)
    return ranges
