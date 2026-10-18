"""Try current whole-owner source proof before independent local annotation OCR."""

from pathlib import Path
from typing import Any

from pypdf import PdfReader

from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget
from .annotation_word_ocr import recognize_annotation_words
from .assembly_state import AssemblyState
from .continuation_presentation_contract import POLICY
from .corroborated_caller_ranges import corroborated_caller_ranges
from .findings import Finding
from .pdf_glyph_ranges import glyph_ranges
from .pdf_link_page import LinkPage
from .pdf_scanned_ranges import scanned_ranges


def ocr_pdf_caller(
    reader: PdfReader,
    target: NavigationTarget,
    annotation: Any,
    caller: Box,
    context: LinkPage,
    state: AssemblyState,
    scratch: Path | None,
    source: Path,
) -> list[tuple[str, int, int]]:
    checkpoint, owners = context.checkpoint, context.owners
    page = checkpoint.observation
    policy = state.source_continuation_policy
    try:
        if policy == POLICY:
            ranges = corroborated_caller_ranges(
                reader, target, annotation, caller, context, policy, source
            )
            message = (
                "Accepted OCR characters exactly match the complete visible source entry; "
                "whole source glyphs locate the link without changing accepted whitespace."
            )
        else:
            ranges = glyph_ranges(
                page, owners, caller, corroborate_ocr=True, source_line_maps=state.native_line_maps
            )
            message = (
                "Accepted visual text exactly matches a unique visible native line; "
                "source glyphs locate the link without rewriting text."
            )
    except ValueError:
        if scratch is None:
            raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW") from None
        if context.words is None:
            context.words = recognize_annotation_words(page, scratch, source, checkpoint.profile_id)
        return scanned_ranges(owners, caller, context.words)
    state.structure_findings.append(
        Finding(
            code="PDF_LINK_NATIVE_GEOMETRY_CORROBORATED",
            severity="information",
            page=page.number,
            message=message,
        )
    )
    return ranges
