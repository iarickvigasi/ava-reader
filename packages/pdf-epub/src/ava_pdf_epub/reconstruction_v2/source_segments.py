"""Recreate source-qualified assembly observations before any model refinement is applied."""

from collections.abc import Sequence
from pathlib import Path
from typing import Any

from .annotation_spans import apply_annotation_spans
from .assemble_pages import assemble_pages
from .assembly_state import AssemblyState
from .bind_printed_targets import bind_printed_targets
from .continuation_margins import continuation_margins
from .linked_furniture import preserve_linked_furniture
from .native_layout_policy import NativeLayoutPolicy
from .native_structure_versions import AnyNativeStructureResponse
from .ocr_indents import recover_ocr_indents
from .ocr_running_furniture import corroborate_running_furniture
from .pdf_links import apply_pdf_links
from .prepared_types import AnyPreparedPage
from .qualify_pages import qualify_pages
from .recognition_contract import RecognitionResponse
from .recover_native_indents import recover_native_indents
from .segments import Segment
from .source_structure import source_structure


def source_segments(
    source: Path,
    scratch: Path,
    prepared: Sequence[AnyPreparedPage],
    responses: list[RecognitionResponse],
    *,
    source_layout_policy: NativeLayoutPolicy | None = None,
    native_structure_responses: Sequence[AnyNativeStructureResponse] | None = None,
    source_title_policy: str | None = None,
) -> tuple[list[dict[str, Any]], list[Segment], AssemblyState]:
    if source_title_policy not in {None, "ava-frontmatter-title-1"}:
        raise ValueError("Unsupported source title policy")
    state = AssemblyState(source_title_policy=source_title_policy)
    qualified = qualify_pages(
        source,
        scratch,
        prepared,
        responses,
        source_layout_policy=source_layout_policy,
        source_line_maps=state.native_line_maps,
        native_structure_responses=native_structure_responses,
        native_hyphen_decisions=state.native_hyphen_decisions,
        native_source_lines=state.native_source_lines,
    )
    qualified = preserve_linked_furniture(source, prepared, qualified, state)
    qualified = corroborate_running_furniture(prepared, qualified, state)
    pages, segments = assemble_pages(prepared, qualified, state)
    if source_title_policy == "ava-frontmatter-title-1":
        # Locate annotations and both link ends on unchanged source owners before
        # compound headings introduce larger boxes or repeated component text.
        segments = _map_source_links(source, scratch, prepared, segments, state)
        segments = bind_printed_targets(segments, state, defer_missing=True)
    segments = source_structure(source, prepared, qualified, segments, state)
    if source_title_policy == "ava-frontmatter-title-1":
        segments = bind_printed_targets(segments, state)
    segments = recover_native_indents(segments, prepared, state)
    segments = recover_ocr_indents(segments, prepared, scratch, state)
    continuation_margins(segments, prepared, scratch, state)
    if source_title_policy is None:
        segments = _map_source_links(source, scratch, prepared, segments, state)
    state.segments.update({s.id: s for s in segments})
    return pages, segments, state


def _map_source_links(
    source: Path,
    scratch: Path,
    prepared: Sequence[AnyPreparedPage],
    segments: list[Segment],
    state: AssemblyState,
) -> list[Segment]:
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
    return segments
