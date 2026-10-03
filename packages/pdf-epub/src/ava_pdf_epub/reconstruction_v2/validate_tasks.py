"""Validate image bytes and task semantics inside the isolated parser before paid dispatch."""

import hashlib
import json
from typing import Literal

from pydantic import Field

from ..contracts.common import Digest, Record
from .accept_response import accept_response
from .recognition_contract import RecognitionResponse, RecognitionTask


class TaskValidationInput(Record):
    mode: Literal["validate_tasks"]
    tasks: list[RecognitionTask] = Field(max_length=64)
    responses: list[RecognitionResponse] = Field(default_factory=list, max_length=64)


class TaskValidationReceipt(Record):
    schema_version: Literal["ava-recognition-tasks-checked-1"]
    request_sha256: Digest
    task_count: int = Field(ge=0, le=64)


def validate_tasks(request_bytes: bytes) -> TaskValidationReceipt:
    if not 0 < len(request_bytes) <= 16 * 1024 * 1024:
        raise ValueError("Recognition validation request byte bound exceeded")
    raw = json.loads(request_bytes)
    has_responses = isinstance(raw, dict) and "responses" in raw
    if not has_responses and len(request_bytes) > 8 * 1024 * 1024:
        raise ValueError("Recognition validation request byte bound exceeded")
    request = TaskValidationInput.model_validate(raw)
    if has_responses:
        if len(request.tasks) != len(request.responses):
            raise ValueError("Recognition task/response counts differ")
        for task, response in zip(request.tasks, request.responses, strict=True):
            accept_response(task, response)
    if len({task.task_id for task in request.tasks}) != len(request.tasks):
        raise ValueError("Repeated recognition task identity")
    return TaskValidationReceipt(
        schema_version="ava-recognition-tasks-checked-1",
        request_sha256=hashlib.sha256(request_bytes).hexdigest(),
        task_count=len(request.tasks),
    )
