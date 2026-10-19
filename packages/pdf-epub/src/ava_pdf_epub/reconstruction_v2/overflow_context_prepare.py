"""Require full source/shape acceptance apart from declared typography contexts before dispatch."""

import hashlib
from typing import Any

from ..contracts.profiles import response_language
from .attempt_exchange import json_bytes, strict_json
from .overflow_context_contract import (
    PROMPT_VERSION,
    RecognitionOverflowContextTask,
    overflow_context_id,
)
from .overflow_context_probe import overflow_context_probe
from .recognition_contract import RecognitionTask
from .recognition_versions import ANCHORED_PROMPT_VERSIONS
from .validate_tasks import validate_tasks


def prepare_overflow_context(
    task: RecognitionTask, original_json: str
) -> RecognitionOverflowContextTask:
    task = RecognitionTask.model_validate(task.model_dump())
    raw = original_json.encode()
    if task.prompt_version not in ANCHORED_PROMPT_VERSIONS or not 0 < len(raw) <= 8 * 1024 * 1024:
        raise ValueError("OVERFLOW_CONTEXT_INPUT_BOUND")
    response = strict_json(raw)
    if not isinstance(response, dict) or (
        response.get("task_id"),
        response.get("source_sha256"),
        response.get("render_sha256"),
    ) != (task.task_id, task.source_sha256, task.image.sha256):
        raise ValueError("OVERFLOW_CONTEXT_SOURCE_DIFFERS")
    response_language(response.get("language", ""), task.profile_id)
    if response.get("unresolved") or any(
        s.get("kind") == "unsupported" for s in response.get("segments", [])
    ):
        raise ValueError("OVERFLOW_CONTEXT_OTHER_UNRESOLVED")
    probe, slots = overflow_context_probe(response)
    validate_tasks(
        json_bytes(
            dict(mode="validate_tasks", tasks=[task.model_dump(mode="json")], responses=[probe])
        )
    )
    fields: dict[str, Any] = dict(
        schema_version="ava-recognition-anchor-context-task-2",
        task_id="pending",
        purpose="repair_overlong_inline_anchor_context",
        prompt_version=PROMPT_VERSION,
        response_schema_version="ava-recognition-anchor-context-response-1",
        source_sha256=task.source_sha256,
        profile_id=task.profile_id,
        page_number=task.page_number,
        original_task_id=task.task_id,
        render_sha256=task.image.sha256,
        native_evidence_sha256=task.native_evidence_sha256,
        original_response_json=original_json,
        original_response_sha256=hashlib.sha256(raw).hexdigest(),
        image=task.image,
        slots=slots,
    )
    fields["task_id"] = overflow_context_id(
        RecognitionOverflowContextTask.model_construct(**fields)
    )
    return RecognitionOverflowContextTask.model_validate(fields)
