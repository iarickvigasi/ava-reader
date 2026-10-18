"""Only current, source-bound full-page recognition can receive TOC source geometry."""

from .continuation_presentation_contract import POLICY
from .native_layout_policy import NATIVE_LAYOUT_POLICY
from .prepared_types import AnyPreparedPage, layout_policy
from .recognition_contract import RecognitionTask
from .segments import Segment
from .structure_claims import title_key
from .task_identity import validate_task
from .text_style_prompt import PINNED_TEXT_STYLE_PROMPT_VERSION, TEXT_STYLE_PROMPT_VERSION


def toc_projection_task(
    checkpoint: AnyPreparedPage, owners: list[Segment], policy: str | None
) -> RecognitionTask | None:
    page = checkpoint.observation
    if (
        policy != POLICY
        or layout_policy(checkpoint) != NATIVE_LAYOUT_POLICY
        or set(page.risks)
        - {"language_uncertain", "native_spacing_unresolved", "native_spacing_unavailable"}
        or sum(
            title_key(line.text) in {"contents", "table of contents", "зміст"}
            for line in page.lines
        )
        != 1
        or page.rotation
        or page.graphics
        or page.required_regions
        or checkpoint.tables
        or checkpoint.native_segments
        or len(checkpoint.tasks) != 1
        or not 4 <= len(owners) <= 257
        or len({s.id for s in owners}) != len(owners)
    ):
        return None
    task = checkpoint.tasks[0]
    if not isinstance(task, RecognitionTask) or (
        task.prompt_version not in {TEXT_STYLE_PROMPT_VERSION, PINNED_TEXT_STYLE_PROMPT_VERSION}
        or task.purpose not in {"pdf_region_recognition", "pdf_structure_repair"}
        or task.source_sha256 != checkpoint.source_sha256
        or task.profile_id != checkpoint.profile_id
        or task.page_number != page.number
        or (task.page_width_pt, task.page_height_pt) != (page.width_pt, page.height_pt)
        or (task.region_box.x0, task.region_box.y0, task.region_box.x1, task.region_box.y1)
        != (0, 0, page.width_pt, page.height_pt)
    ):
        return None
    if any(
        s.id != f"page{page.number}-{task.task_id[10:22]}-{i}"
        or s.page != page.number
        or s.method != "ocr"
        or s.native_line_ids
        or s.source_text is not None
        or s.kind not in {"paragraph", "heading", "list_item"}
        or s.related_to
        or s.note_label
        or s.continues_from_previous
        or s.continues_to_next
        or s.structure_candidate
        or s.source_marginal_furniture
        or not s.box.within(page.width_pt, page.height_pt)
        for i, s in enumerate(owners)
    ):
        return None
    try:
        validate_task(task)
    except (ValueError, OSError):
        return None
    return task
