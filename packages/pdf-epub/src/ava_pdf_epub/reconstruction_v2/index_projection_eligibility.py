"""Only the current qualified full-page index route can derive source geometry."""

import re

from .continuation_presentation_contract import POLICY
from .index_layout import INDEX_LAYOUT_RISK, index_rows
from .index_prompt import INDEX_PROMPT_VERSION
from .native_layout_policy import NATIVE_LAYOUT_POLICY
from .ocr_glyph_owner import ALLOWED_RISKS
from .prepared_types import AnyPreparedPage, layout_policy
from .recognition_contract import RecognitionTask
from .segments import Segment


def index_projection_task(
    checkpoint: AnyPreparedPage, owners: list[Segment], policy: str | None
) -> RecognitionTask | None:
    page = checkpoint.observation
    if (
        policy != POLICY
        or layout_policy(checkpoint) != NATIVE_LAYOUT_POLICY
        or INDEX_LAYOUT_RISK not in page.risks
        or set(page.risks) - ALLOWED_RISKS
        or not index_rows(page)
        or page.rotation
        or page.graphics
        or page.required_regions
        or checkpoint.native_segments
        or len(checkpoint.tasks) != 1
        or not owners
        or len({s.id for s in owners}) != len(owners)
    ):
        return None
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
        return None
    if any(
        s.page != page.number
        or s.method != "ocr"
        or s.native_line_ids
        or s.source_text is not None
        or s.kind not in {"paragraph", "heading", "furniture"}
        or s.related_to
        or s.note_label
        or s.continues_from_previous
        or s.continues_to_next
        or s.structure_candidate
        or not s.box.within(page.width_pt, page.height_pt)
        or not re.fullmatch(rf"page{page.number}-{re.escape(task.task_id[10:22])}-[0-9]+", s.id)
        for s in owners
    ):
        return None
    return task
