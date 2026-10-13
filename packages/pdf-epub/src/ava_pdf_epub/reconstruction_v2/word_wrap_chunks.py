"""Pack public tasks by both entry count and UTF-8 bytes, never by characters alone."""

from collections.abc import Sequence
from typing import Any

from .word_wrap_fields import WordWrapEntry
from .word_wrap_identity import MAX_PUBLIC_TASK_BYTES, _wire


def word_wrap_chunks(
    entries: Sequence[WordWrapEntry], headers: dict[str, Any]
) -> list[list[WordWrapEntry]]:
    chunks: list[list[WordWrapEntry]] = []
    current: list[WordWrapEntry] = []
    for entry in entries:
        proposed = [*current, entry]
        if current and (
            len(proposed) > 128 or _public_bytes(proposed, headers) > MAX_PUBLIC_TASK_BYTES
        ):
            chunks.append(current)
            current = []
        current.append(entry)
        if _public_bytes(current, headers) > MAX_PUBLIC_TASK_BYTES:
            raise ValueError("Word-wrap single public entry exceeds the task byte bound")
    if current:
        chunks.append(current)
    if len(chunks) > 32:
        raise ValueError("Word-wrap catalogue exceeds the finite task count")
    return chunks


def _public_bytes(entries: list[WordWrapEntry], headers: dict[str, Any]) -> int:
    values = {
        **headers,
        "task_id": "native-word-wrap-" + "0" * 64,
        "batch_index": 31,
        "batch_count": 32,
        "entries": [
            entry.model_dump(mode="json", include={"id", "role", "language", "context"})
            for entry in entries
        ],
    }
    return len(_wire(values).encode("utf-8"))
