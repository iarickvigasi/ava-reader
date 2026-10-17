"""Validate private sparse context and response before any later provider dispatch."""

import hashlib
import json

from .word_wrap_contract import WordWrapResponse, WordWrapTask
from .word_wrap_response import validate_word_wrap_response


def validate_word_wrap(data: bytes) -> dict[str, object]:
    raw = json.loads(data)
    if set(raw) != {"mode", "task", "response"} or raw["mode"] != "validate_word_wrap":
        raise ValueError("Invalid native word-wrap validation packet")
    task = WordWrapTask.model_validate(raw["task"])
    if raw["response"] is not None:
        validate_word_wrap_response(task, WordWrapResponse.model_validate(raw["response"]))
    return dict(
        schema_version="ava-word-wrap-validation-1",
        valid=True,
        request_sha256=hashlib.sha256(data).hexdigest(),
    )
