"""Retain the existing native caller, explicit-label and higher-resolution fallbacks."""

from pathlib import Path
from typing import Any

from pypdf import PdfReader

from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget
from .assembly_state import AssemblyState
from .findings import Finding
from .literal_page_label import literal_page_label_range
from .native_caller_context import NativeCallerLowConfidence, native_caller_ranges
from .native_link_resolution import NativeLinkResolution
from .native_literal_uri import raw_literal_uri
from .pdf_link_page import LinkPage


def native_pdf_caller(
    reader: PdfReader,
    target: NavigationTarget,
    annotation: Any,
    caller: Box,
    context: LinkPage,
    state: AssemblyState,
    scratch: Path,
    resolution: NativeLinkResolution,
) -> list[tuple[str, int, int]]:
    checkpoint, owners = context.checkpoint, context.owners
    label = literal_page_label_range(
        reader,
        target,
        checkpoint.observation,
        owners,
        caller,
        state.native_line_maps,
        annotation=annotation,
    )
    if label is not None:
        state.structure_findings.append(
            Finding(
                code="PDF_LINK_PAGE_LABEL_CORROBORATED",
                severity="information",
                page=checkpoint.observation.number,
                message=(
                    "An explicit unique PDF page label and qualified native "
                    "digits identify the reference; its comma stays unlinked."
                ),
            )
        )
        return label
    try:
        return native_caller_ranges(
            checkpoint.observation,
            owners,
            caller,
            scratch,
            checkpoint.profile_id,
            state.native_line_maps,
            context.native_words,
            literal_uri=raw_literal_uri(annotation, target),
            findings=state.structure_findings,
        )
    except NativeCallerLowConfidence:
        # A fresh cache prevents reuse of lower-resolution word boxes.
        ranges = native_caller_ranges(
            resolution.observation(),
            owners,
            caller,
            resolution.directory,
            checkpoint.profile_id,
            state.native_line_maps,
            resolution.words,
            literal_uri=raw_literal_uri(annotation, target),
            findings=state.structure_findings,
        )
        state.structure_findings.append(
            Finding(
                code="PDF_LINK_HIGH_RESOLUTION_CORROBORATED",
                severity="information",
                page=checkpoint.observation.number,
                message=(
                    "One higher-resolution source render passed unchanged "
                    "text, confidence and geometry checks for this link."
                ),
            )
        )
        return ranges
