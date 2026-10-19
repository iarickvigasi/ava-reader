"""Source geometry is projected before regions, placements, evidence or crops are created."""

from collections.abc import Sequence
from pathlib import Path

from pypdf import PdfReader

from .assembly_state import AssemblyState
from .index_page_projection import index_page_projection
from .index_projection_eligibility import index_projection_task
from .ocr_glyph_frame import glyph_frame_safe
from .prepared_types import AnyPreparedPage
from .segments import Segment


def project_index_pages(
    source: Path,
    prepared: Sequence[AnyPreparedPage],
    qualified: dict[int, list[Segment]],
    state: AssemblyState,
) -> dict[int, list[Segment]]:
    selected = [
        p
        for p in prepared
        if index_projection_task(
            p, qualified[p.observation.number], state.source_continuation_policy
        )
        is not None
    ]
    if not selected:
        return qualified
    output = dict(qualified)
    reader = PdfReader(source, strict=True)
    try:
        for checkpoint in selected:
            page = checkpoint.observation
            if not glyph_frame_safe(reader.pages[page.number - 1], page):
                continue
            result = index_page_projection(
                checkpoint, qualified[page.number], state.source_continuation_policy
            )
            if result is not None:
                output[page.number], state.source_index_projections[page.number] = result
    finally:
        reader.close()
    return output
