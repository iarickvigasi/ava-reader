"""Private catalogue identity binds all qualified pairs before finite provider dispatch."""

import json
from collections.abc import Sequence
from typing import TYPE_CHECKING, Any

from ..contracts.common import Record, text_digest, unique

if TYPE_CHECKING:
    from .word_wrap_contract import WordWrapTask

MAX_PRIVATE_CATALOGUE_BYTES = 8 * 1024 * 1024
MAX_PUBLIC_TASK_BYTES = 48 * 1024
MAX_CATALOGUE_ENTRIES = 4096


def word_wrap_digest(records: Sequence[Record]) -> str:
    return text_digest(_wire([record.model_dump(mode="json") for record in records]))


def word_wrap_identifier(values: dict[str, Any]) -> str:
    return "native-word-wrap-" + text_digest(
        _wire({k: v for k, v in values.items() if k != "task_id"})
    )


def word_wrap_public_task(task: "WordWrapTask") -> dict[str, Any]:
    values = task.model_dump(mode="json", exclude={"entries"})
    values["entries"] = [
        entry.model_dump(mode="json", include={"id", "role", "language", "context"})
        for entry in task.entries
    ]
    if len(_wire(values).encode("utf-8")) > MAX_PUBLIC_TASK_BYTES:
        raise ValueError("Word-wrap public task exceeds the byte bound")
    return values


def validate_word_wrap_task(task: "WordWrapTask") -> None:
    from ..contracts.profiles import response_language

    unique([entry.id for entry in task.entries], "word-wrap entry")
    unique([entry.candidate.id for entry in task.entries], "word-wrap candidate")
    if any(not 1 <= int(entry.id[1:]) <= MAX_CATALOGUE_ENTRIES for entry in task.entries):
        raise ValueError("Word-wrap task has an out-of-catalogue opaque ID")
    if len(_wire(task.model_dump(mode="json")).encode("utf-8")) > MAX_PRIVATE_CATALOGUE_BYTES:
        raise ValueError("Word-wrap private task exceeds the complete catalogue byte bound")
    if task.batch_index >= task.batch_count:
        raise ValueError("Word-wrap task batch index differs")
    if any(entry.candidate.source_sha256 != task.source_sha256 for entry in task.entries):
        raise ValueError("Word-wrap task contains another source")
    for entry in task.entries:
        response_language(entry.language, task.profile_id)
    if task.task_id != word_wrap_identifier(task.model_dump(mode="json")):
        raise ValueError("Word-wrap task identity differs")
    word_wrap_public_task(task)


def _wire(value: object) -> str:
    return json.dumps(
        value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    )
