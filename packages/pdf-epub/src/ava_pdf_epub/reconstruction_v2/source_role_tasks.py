"""Only essential missing-reference owners receive new, finite current-only role tasks."""

from collections import defaultdict
from pathlib import Path

from ..contracts.common import document_digest, text_digest
from .assembly_state import AssemblyState
from .continuation_presentation_contract import POLICY
from .page_checkpoints import PreparedPageMap
from .refinement_capacity import refinement_task_limit
from .refinement_identity import refinement_identifier
from .segments import Segment
from .source_refusal import refuse_segment
from .source_role_contract import SourceRoleNode, SourceRoleTask
from .source_role_sheet import source_role_sheet


def source_role_tasks(
    source_sha: str,
    observation_sha: str,
    scratch: Path,
    pages: PreparedPageMap,
    candidates: list[Segment],
    state: AssemblyState,
    prior_tasks: int,
) -> list[SourceRoleTask]:
    if not candidates:
        return []
    if state.source_continuation_policy != POLICY or len(candidates) > 24:
        refused = candidates[min(24, len(candidates) - 1)]
        refuse_segment(pages[refused.page], refused)
    groups: dict[int, list[Segment]] = defaultdict(list)
    for owner in candidates:
        groups[owner.page].append(owner)
    pending = list(groups.values())
    tasks: list[SourceRoleTask] = []
    while pending:
        owners = pending.pop(0)
        checkpoint = pages[owners[0].page]
        if checkpoint.source_sha256 != source_sha or any(
            s.method != "ocr" or s.structure_candidate or s.kind not in {"paragraph", "quote"}
            for s in owners
        ):
            refuse_segment(checkpoint, owners[0])
        sheet = source_role_sheet(checkpoint, owners, scratch)
        if sheet is None and len(owners) > 1:
            middle = len(owners) // 2
            pending[0:0] = [owners[:middle], owners[middle:]]
            continue
        if sheet is None or prior_tasks + len(tasks) >= refinement_task_limit(
            state.source_continuation_policy
        ):
            refuse_segment(checkpoint, owners[0])
        assert sheet is not None
        crops, image = sheet
        raw = dict(
            schema_version="ava-book-refinement-task-6",
            source_sha256=source_sha,
            observation_sha256=observation_sha,
            profile_id=checkpoint.profile_id,
            prompt_version="ava-book-refinement-9",
            response_schema_version="ava-book-refinement-response-6",
            page=checkpoint.observation.number,
            page_width_pt=checkpoint.observation.width_pt,
            page_height_pt=checkpoint.observation.height_pt,
            pixels_per_point=2,
            nodes=[
                SourceRoleNode(
                    id=s.id,
                    page=s.page,
                    kind="quote" if s.kind == "quote" else "paragraph",
                    source_box=s.box,
                    text_sha256=text_digest(s.text),
                    owner_sha256=document_digest(s),
                    text_length=len(s.text),
                    text_excerpt=s.text[:500],
                ).model_dump(mode="json")
                for s in owners
            ],
            crops=[c.model_dump(mode="json") for c in crops],
            image=image.model_dump(mode="json"),
        )
        raw["task_id"] = refinement_identifier(raw)
        tasks.append(SourceRoleTask.model_validate(raw))
    return tasks
