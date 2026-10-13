"""Preserve historical Input1-4 assembly order independently of sparse authority."""

from collections.abc import Sequence
from pathlib import Path

from ..worker_observation import phase
from .apply_refinement import apply_refinement
from .compound_wraps import compact_native_compounds
from .continuation_margins import continuation_margins
from .native_layout_policy import NativeLayoutPolicy
from .native_structure_contract import NativeStructureResponse
from .normalize_list_bodies import capture_list_bodies
from .normalize_native_hyphens import normalize_native_hyphens
from .ocr_font_faces import corroborate_ocr_font_faces
from .prepare_refinement import prepare_refinement
from .prepared_types import AnyPreparedPage
from .printed_markers import printed_markers
from .recognition_contract import RecognitionResponse
from .refinement_contract import AnyRefinementResponse
from .source_feature_contract import FEATURE_POLICY
from .source_page_starts import capture_page_starts
from .source_segments import source_segments
from .stream_joins import stream_joins
from .word_wrap_assembly import WordWrapAssembly


def legacy_reconstruction_assembly(
    source: Path,
    scratch: Path,
    prepared: Sequence[AnyPreparedPage],
    responses: list[RecognitionResponse],
    refinements: list[AnyRefinementResponse] | None,
    source_feature_policy: str | None,
    source_layout_policy: NativeLayoutPolicy | None,
    native_structure_responses: list[NativeStructureResponse] | None,
) -> WordWrapAssembly:
    pages, segments, state = source_segments(
        source,
        scratch,
        prepared,
        responses,
        source_layout_policy=source_layout_policy,
        native_structure_responses=native_structure_responses,
    )
    if refinements is not None:
        with phase("prepare_refinement"):
            tasks = prepare_refinement(
                source,
                scratch,
                prepared,
                segments,
                state,
                source_feature_policy=source_feature_policy,
            )
        if tasks or refinements:
            segments = apply_refinement(segments, tasks, refinements, state)
        del tasks
    if source_feature_policy is not None and refinements is None:
        raise ValueError("Current source feature policy requires complete refinement receipts")
    segments = corroborate_ocr_font_faces(source, prepared, segments, state)
    for page in pages:
        page["label"] = state.page_labels.get(page["number"])
    if source_feature_policy == FEATURE_POLICY:
        capture_list_bodies(segments, prepared, state)
    segments = compact_native_compounds(printed_markers(segments, state), state)
    segments = normalize_native_hyphens(segments, state)
    for segment in segments:
        state.segments[segment.id] = segment
    continuation_margins(segments, prepared, scratch, state)
    size_sources = segments
    page_starts = capture_page_starts(segments, state)
    return WordWrapAssembly(pages, stream_joins(segments, state), state, size_sources, page_starts)
