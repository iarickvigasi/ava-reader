"""Stock pre-dispatch validation retains exact source and immutable raw candidate identity."""

import hashlib

from .attempt_exchange import strict_json
from .overflow_context_contract import RecognitionOverflowContextTask
from .overflow_context_prepare import prepare_overflow_context
from .recognition_contract import RecognitionTask


def validate_overflow_context(data: bytes) -> dict[str, object]:
    if not 0 < len(data) <= 16 * 1024 * 1024:
        raise ValueError("OVERFLOW_CONTEXT_VALIDATION_BOUND")
    raw = strict_json(data)
    if (
        not isinstance(raw, dict)
        or set(raw) != {"mode", "task", "correction"}
        or raw["mode"] != "validate_anchor_context"
    ):
        raise ValueError("OVERFLOW_CONTEXT_VALIDATION_FIELDS")
    parent = RecognitionTask.model_validate(raw["task"])
    correction = RecognitionOverflowContextTask.model_validate(raw["correction"])
    if prepare_overflow_context(parent, correction.original_response_json) != correction:
        raise ValueError("OVERFLOW_CONTEXT_VALIDATION_DIFFERS")
    return dict(
        schema_version="ava-anchor-context-checked-2",
        request_sha256=hashlib.sha256(data).hexdigest(),
        task_id=correction.task_id,
    )
