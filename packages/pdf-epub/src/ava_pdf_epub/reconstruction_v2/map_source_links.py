"""Map annotations and both source-link ends before larger compound owners are introduced."""

from collections.abc import Sequence
from pathlib import Path

from .annotation_spans import apply_annotation_spans
from .assembly_state import AssemblyState
from .pdf_links import apply_pdf_links
from .prepared_types import AnyPreparedPage
from .segments import Segment


def map_source_links(
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
