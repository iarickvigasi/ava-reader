"""Source/role checks finish before sparse decisions; the same snapshot drives final assembly."""

from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..worker_observation import phase
from .apply_refinement import apply_refinement
from .assembly_state import AssemblyState
from .bind_printed_targets import bind_printed_targets
from .continuation_margins import continuation_margins
from .native_layout_policy import NativeLayoutPolicy
from .native_structure_contract import NativeStructureResponse
from .normalize_list_bodies import capture_list_bodies
from .ocr_font_faces import corroborate_ocr_font_faces
from .prepare_refinement import prepare_refinement
from .prepared_types import AnyPreparedPage
from .printed_markers import printed_markers
from .printed_title_v2_contract import FrontmatterTitleResponse
from .recognition_contract import RecognitionResponse
from .refinement_contract import AnyRefinementResponse
from .segments import Segment
from .source_feature_contract import FEATURE_POLICY
from .source_page_starts import SourcePageStart, capture_page_starts
from .source_segments import source_segments
from .stream_joins import stream_joins


@dataclass
class WordWrapAssembly:
    pages: list[dict[str, Any]]
    segments: list[Segment]
    state: AssemblyState
    size_sources: list[Segment]
    page_starts: dict[int, SourcePageStart]


def word_wrap_assembly(
    source: Path,
    scratch: Path,
    prepared: Sequence[AnyPreparedPage],
    responses: list[RecognitionResponse],
    refinements: list[AnyRefinementResponse | FrontmatterTitleResponse],
    native_structure_responses: list[NativeStructureResponse],
    source_layout_policy: NativeLayoutPolicy,
    *,
    source_title_policy: str | None = None,
) -> WordWrapAssembly:
    pages, segments, state = source_segments(
        source,
        scratch,
        prepared,
        responses,
        source_layout_policy=source_layout_policy,
        source_title_policy=source_title_policy,
        native_structure_responses=native_structure_responses,
    )
    state.word_wrap_active = True
    with phase("prepare_refinement"):
        tasks = prepare_refinement(
            source,
            scratch,
            prepared,
            segments,
            state,
            source_feature_policy=FEATURE_POLICY,
            source_title_policy=source_title_policy,
        )
    segments = apply_refinement(segments, tasks, refinements, state)
    segments = corroborate_ocr_font_faces(source, prepared, segments, state)
    for page in pages:
        page["label"] = state.page_labels.get(page["number"])
    capture_list_bodies(segments, prepared, state)
    segments = bind_printed_targets(segments, state)
    # Input5 classifies every eligible physical wrap once. Pre-compaction would
    # change the raw metadata receipt's input before its checked projection.
    segments = printed_markers(segments, state)
    state.segments.update({segment.id: segment for segment in segments})
    continuation_margins(segments, prepared, scratch, state)
    starts = capture_page_starts(segments, state)
    # Joining is existing source/receipt authority. Sparse decisions may remove a
    # qualified wrap, but cannot combine paragraphs or change reading order.
    joined = stream_joins(segments, state)
    return WordWrapAssembly(pages, joined, state, segments, starts)
