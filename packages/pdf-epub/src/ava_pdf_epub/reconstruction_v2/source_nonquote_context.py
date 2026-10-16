"""Positive source context distinguishes contents and pagination notices from quotations."""

import hashlib
import json
import re
from collections.abc import Sequence

from .assembly_state import AssemblyState
from .page_checkpoints import PreparedPageMap
from .recognition_contract import RecognitionTask
from .segments import Segment
from .structure_claims import StructureClaim


def contents_owner_identity(segment: Segment) -> str:
    # Later indentation recovery may change style, but never these source-owned fields.
    value = segment.model_dump(
        mode="json",
        include={
            "id",
            "page",
            "box",
            "text",
            "source_text",
            "kind",
            "continues_from_previous",
            "continues_to_next",
            "related_to",
        },
    )
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def record_contents_context(
    claims: Sequence[StructureClaim], segments: list[Segment], state: AssemblyState
) -> None:
    """Call only after every printed claim resolves to its corroborated opening."""
    owners = {s.id: s for s in segments}
    for claim in claims:
        owner = owners.get(claim.source_id or "")
        if owner is None or owner.kind != "paragraph" or claim.printed_page is None:
            continue
        if owner.continues_from_previous or owner.continues_to_next or owner.related_to:
            continue
        # A partial title match must not exempt adjacent prose or a second contents row.
        pattern = re.escape(claim.title) + r"(?:\s+|\s*\.{2,}\s*)" + re.escape(claim.printed_page)
        if re.fullmatch(pattern, owner.text) is not None and (
            owner.source_text is None or owner.source_text == owner.text
        ):
            state.source_contents_rows[owner.id] = contents_owner_identity(owner)


def nonquote_context(
    segment: Segment, page_segments: list[Segment], pages: PreparedPageMap, state: AssemblyState
) -> bool:
    if segment.kind != "paragraph" or segment.structure_candidate:
        return False
    if state.source_contents_rows.get(segment.id) == contents_owner_identity(segment):
        return True
    if segment.method != "ocr":
        return False
    # This is an exact conventional notice, not a keyword classifier for arbitrary italic prose.
    if segment.text.casefold() not in {
        "this page intentionally left blank",
        "this page intentionally left blank.",
    }:
        return False
    if (
        len(page_segments) != 1
        or page_segments[0].id != segment.id
        or segment.continues_from_previous
        or segment.continues_to_next
        or segment.related_to
        or segment.note_label
        or segment.source_text not in {None, segment.text}
        or segment.style is None
        or segment.style.align != "center"
        or any(s.note_label or s.target_text or s.url for s in segment.spans)
        or any(t[0] == segment.id or t[3] == segment.id for t in state.internal_targets)
    ):
        return False
    prepared = pages[segment.page]
    page = prepared.observation
    # Source segments reach this phase only after qualify_pages accepts every response.
    # Bind the sole notice to that complete-page OCR owner, never to partial/native evidence.
    if len(prepared.tasks) != 1 or prepared.native_segments:
        return False
    task = prepared.tasks[0]
    if not isinstance(task, RecognitionTask) or (
        task.source_sha256 != prepared.source_sha256
        or task.profile_id != prepared.profile_id
        or task.page_number != page.number
        or (task.page_width_pt, task.page_height_pt) != (page.width_pt, page.height_pt)
        or (task.region_box.x0, task.region_box.y0, task.region_box.x1, task.region_box.y1)
        != (0, 0, page.width_pt, page.height_pt)
        or not re.fullmatch(
            rf"page{page.number}-{re.escape(task.task_id[10:22])}-[0-9]+", segment.id
        )
    ):
        return False
    # A single full-page scan is the visible OCR canvas, not a separate illustration.
    full_scan = (
        len(page.graphics) == 1
        and page.graphics[0].kind == "image"
        and (
            page.graphics[0].box.x0 == 0
            and page.graphics[0].box.y0 == 0
            and page.graphics[0].box.x1 == page.width_pt
            and page.graphics[0].box.y1 == page.height_pt
        )
    )
    return (
        page.rotation == 0
        and set(page.risks) <= {"conditional_visibility", "language_uncertain"}
        and (not page.graphics or full_scan)
        and not page.required_regions
        and segment.box.within(page.width_pt, page.height_pt)
        and abs((segment.box.x0 + segment.box.x1) / 2 - page.width_pt / 2) <= page.width_pt * 0.05
    )
