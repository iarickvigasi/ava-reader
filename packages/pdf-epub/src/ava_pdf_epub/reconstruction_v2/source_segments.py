"""Recreate source-qualified assembly observations before any model refinement is applied."""

from collections.abc import Sequence
from pathlib import Path
from typing import Any

from .annotation_spans import apply_annotation_spans
from .assemble_pages import assemble_pages
from .assembly_state import AssemblyState
from .continuation_margins import continuation_margins
from .linked_furniture import preserve_linked_furniture
from .ocr_indents import recover_ocr_indents
from .ocr_running_furniture import corroborate_running_furniture
from .pdf_links import apply_pdf_links
from .prepared import PreparedPage
from .qualify_pages import qualify_pages
from .recognition_contract import RecognitionResponse
from .segments import Segment
from .source_structure import source_structure


def source_segments(
    source: Path,
    scratch: Path,
    prepared: Sequence[PreparedPage],
    responses: list[RecognitionResponse],
) -> tuple[list[dict[str, Any]], list[Segment], AssemblyState]:
    qualified = qualify_pages(source, scratch, prepared, responses)
    state = AssemblyState()
    qualified = preserve_linked_furniture(source, prepared, qualified, state)
    qualified = corroborate_running_furniture(prepared, qualified, state)
    pages, segments = assemble_pages(prepared, qualified, state)
    segments = source_structure(source, prepared, qualified, segments, state)
    segments = recover_ocr_indents(segments, prepared, scratch, state)
    continuation_margins(segments, prepared, scratch, state)
    for checkpoint in prepared:
        local = [s for s in segments if s.page == checkpoint.observation.number]
        mapped = {
            s.id: s
            for s in apply_annotation_spans(
                checkpoint.observation, local, scratch, source, checkpoint.profile_id
            )
        }
        segments = [mapped.get(s.id, s) for s in segments]
        state.segments.update(mapped)
    segments = apply_pdf_links(source, prepared, segments, state, scratch)
    state.segments.update({s.id: s for s in segments})
    return pages, segments, state
