"""Recreate source-qualified assembly observations before any model refinement is applied."""

from collections.abc import Sequence
from pathlib import Path
from typing import Any

from .assemble_pages import assemble_pages
from .assembly_state import AssemblyState
from .bind_printed_targets import bind_printed_targets
from .continuation_margins import continuation_margins
from .corroborate_index_headers import corroborate_index_headers
from .index_context import record_index_context
from .index_indents import recover_index_indents
from .linked_furniture import preserve_linked_furniture
from .map_source_links import map_source_links
from .native_layout_policy import NativeLayoutPolicy
from .native_structure_versions import AnyNativeStructureResponse
from .ocr_indents import recover_ocr_indents
from .ocr_running_furniture import corroborate_running_furniture
from .prepared_types import AnyPreparedPage
from .project_index_pages import project_index_pages
from .project_toc_pages import project_toc_pages
from .qualify_pages import qualify_pages
from .recognition_contract import RecognitionResponse
from .recover_native_indents import recover_native_indents
from .recover_source_quotes import recover_source_quotes
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
    source_continuation_policy: str | None = None,
) -> tuple[list[dict[str, Any]], list[Segment], AssemblyState]:
    if source_title_policy not in {None, "ava-frontmatter-title-1"}:
        raise ValueError("Unsupported source title policy")
    from .continuation_presentation_contract import POLICY

    if source_continuation_policy not in {None, POLICY}:
        raise ValueError("Unsupported source continuation policy")
    state = AssemblyState(
        source_title_policy=source_title_policy,
        source_continuation_policy=source_continuation_policy,
    )
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
        native_continuations=state.native_continuations,
        native_paragraph_layout=source_continuation_policy is not None,
    )
    qualified = corroborate_index_headers(source, prepared, qualified, state)
    qualified = preserve_linked_furniture(source, prepared, qualified, state)
    qualified = corroborate_running_furniture(prepared, qualified, state)
    qualified = project_index_pages(source, prepared, qualified, state)
    qualified = project_toc_pages(source, scratch, prepared, qualified, state)
    pages, segments = assemble_pages(prepared, qualified, state)
    segments = recover_source_quotes(prepared, segments, state)
    if source_title_policy == "ava-frontmatter-title-1":
        # Locate annotations and both link ends on unchanged source owners before
        # compound headings introduce larger boxes or repeated component text.
        segments = map_source_links(source, scratch, prepared, segments, state)
        segments = bind_printed_targets(segments, state, defer_missing=True)
    segments = source_structure(source, prepared, qualified, segments, state)
    if source_title_policy == "ava-frontmatter-title-1":
        segments = bind_printed_targets(segments, state)
    segments = recover_native_indents(segments, prepared, state)
    segments = recover_ocr_indents(segments, prepared, scratch, state)
    continuation_margins(segments, prepared, scratch, state)
    if source_title_policy is None:
        segments = map_source_links(source, scratch, prepared, segments, state)
    record_index_context(prepared, segments, state)
    segments = recover_index_indents(prepared, segments, state)
    from .continuation_metrics import corroborate_continuation_metrics

    segments = corroborate_continuation_metrics(source, scratch, prepared, segments, state)
    state.segments.update({s.id: s for s in segments})
    return pages, segments, state
