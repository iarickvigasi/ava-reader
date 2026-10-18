"""Recover missing OCR heading families from existing uniform source-font proofs."""

from collections.abc import Sequence
from pathlib import Path

from .assembly_state import AssemblyState
from .continuation_presentation_contract import POLICY
from .ocr_font_faces import corroborate_ocr_font_faces
from .page_checkpoints import PreparedPageMap
from .prepared_types import AnyPreparedPage
from .segments import Segment


def corroborate_heading_families(
    source: Path,
    prepared: Sequence[AnyPreparedPage],
    segments: list[Segment],
    state: AssemblyState,
) -> list[Segment]:
    if (
        state.source_title_policy != "ava-frontmatter-title-1"
        or state.source_continuation_policy != POLICY
    ):
        return segments
    selected = [
        s
        for s in segments
        if s.method == "ocr"
        and (s.kind == "heading" or s.structure_candidate)
        and (s.style is None or s.style.family is None)
    ]
    if not selected:
        return segments
    pages = PreparedPageMap(prepared)
    checkpoints = [pages[number] for number in sorted({s.page for s in selected})]
    # Selection limits updates, never the peer list used to prove unique ownership.
    # Mixed font runs remain on the existing later path; strict joining still
    # refuses an unknown component rather than repeatedly appending derived runs.
    return corroborate_ocr_font_faces(
        source,
        checkpoints,
        segments,
        state,
        uniform_owner_ids=frozenset(s.id for s in selected),
    )
