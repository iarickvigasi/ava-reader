"""Only a complete, bound correction can replace contexts and reach normal acceptance."""

import copy
from typing import Any

from .attempt_exchange import json_bytes, strict_json
from .overflow_context_contract import RecognitionOverflowContextTask
from .overflow_context_prepare import prepare_overflow_context
from .recognition_anchor_context import RecognitionAnchorContextResponse
from .recognition_contract import RecognitionTask
from .source_refusal import refuse_task
from .validate_tasks import validate_tasks


def apply_overflow_context(
    parent: RecognitionTask,
    task: RecognitionOverflowContextTask,
    reply: RecognitionAnchorContextResponse,
) -> dict[str, Any]:
    task = RecognitionOverflowContextTask.model_validate(task.model_dump())
    reply = RecognitionAnchorContextResponse.model_validate(reply.model_dump())
    if prepare_overflow_context(parent, task.original_response_json) != task or (
        reply.task_id,
        reply.source_sha256,
        reply.original_task_id,
        reply.render_sha256,
        reply.original_response_sha256,
    ) != (
        task.task_id,
        task.source_sha256,
        task.original_task_id,
        task.render_sha256,
        task.original_response_sha256,
    ):
        raise ValueError("OVERFLOW_CONTEXT_REPLY_DIFFERS")
    if reply.outcome != "corrected":
        refuse_task(parent, "RECOGNITION_UNRESOLVED")
    slots = {(s.segment_index, s.span_index): s for s in task.slots}
    keys = [(p.segment_index, p.span_index) for p in reply.patches]
    if len(set(keys)) != len(keys) or set(keys) != set(slots):
        raise ValueError("OVERFLOW_CONTEXT_PATCH_COVERAGE_DIFFERS")
    result: dict[str, Any] = copy.deepcopy(strict_json(task.original_response_json.encode()))
    for patch in reply.patches:
        slot = slots[(patch.segment_index, patch.span_index)]
        if patch.span_sha256 != slot.span_sha256:
            raise ValueError("OVERFLOW_CONTEXT_SPAN_DIFFERS")
        result["segments"][patch.segment_index]["spans"][patch.span_index]["anchor"].update(
            before=patch.before, after=patch.after
        )
    validate_tasks(
        json_bytes(
            dict(mode="validate_tasks", tasks=[parent.model_dump(mode="json")], responses=[result])
        )
    )
    return result
