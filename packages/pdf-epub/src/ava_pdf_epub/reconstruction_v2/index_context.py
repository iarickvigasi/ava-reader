"""Exact source-owned index entries are not ordinary prose or inset quotations."""

import re
from collections.abc import Sequence

from .assembly_state import AssemblyState
from .continuation_presentation_contract import POLICY
from .index_entry_receipt import IndexEntryReceipt
from .index_entry_source import source_index_entry
from .index_layout import INDEX_LAYOUT_RISK, index_rows
from .index_prompt import INDEX_PROMPT_VERSION
from .native_layout_policy import NATIVE_LAYOUT_POLICY
from .ocr_glyph_map import prove_glyph_map
from .prepared_types import AnyPreparedPage, layout_policy
from .recognition_contract import RecognitionTask
from .segments import Segment
from .source_context_identity import source_context_identity


def record_index_context(
    prepared: Sequence[AnyPreparedPage], segments: list[Segment], state: AssemblyState
) -> None:
    if state.source_continuation_policy != POLICY:
        return
    for checkpoint in prepared:
        page = checkpoint.observation
        rows = index_rows(page) if INDEX_LAYOUT_RISK in page.risks else []
        if (
            layout_policy(checkpoint) != NATIVE_LAYOUT_POLICY
            or not rows
            or checkpoint.native_segments
            or len(checkpoint.tasks) != 1
        ):
            continue
        task = checkpoint.tasks[0]
        if not isinstance(task, RecognitionTask) or (
            task.prompt_version != INDEX_PROMPT_VERSION
            or task.purpose != "pdf_structure_repair"
            or task.source_sha256 != checkpoint.source_sha256
            or task.profile_id != checkpoint.profile_id
            or task.page_number != page.number
            or (task.region_box.x0, task.region_box.y0, task.region_box.x1, task.region_box.y1)
            != (0, 0, page.width_pt, page.height_pt)
        ):
            continue
        owners = [s for s in segments if s.page == page.number]
        for owner in owners:
            if (
                owner.kind != "paragraph"
                or owner.structure_candidate
                or owner.continues_from_previous
                or owner.continues_to_next
                or owner.related_to
                or owner.note_label
                or not re.fullmatch(
                    rf"page{page.number}-{re.escape(task.task_id[10:22])}-[0-9]+", owner.id
                )
            ):
                continue
            proof = prove_glyph_map(page, owner, owners, POLICY)
            if proof is not None and source_index_entry(page, owner, proof):
                state.source_index_entries[owner.id] = IndexEntryReceipt(
                    source_context_identity(owner)
                )


def independent_index_entry(segment: Segment, state: AssemblyState) -> bool:
    receipt = state.source_index_entries.get(segment.id)
    return (
        state.source_continuation_policy == POLICY
        and segment.method == "ocr"
        and not segment.native_line_ids
        and receipt is not None
        and receipt.owner_identity == source_context_identity(segment)
    )
