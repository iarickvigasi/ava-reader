"""Validate whole catalogue/census coverage, task order and complete private byte bounds."""

from typing import TYPE_CHECKING

from ..contracts.common import unique
from .word_wrap_identity import (
    MAX_CATALOGUE_ENTRIES,
    MAX_PRIVATE_CATALOGUE_BYTES,
    _wire,
    word_wrap_digest,
)

if TYPE_CHECKING:
    from .word_wrap_contract import WordWrapBatch


def validate_word_wrap_batch(batch: "WordWrapBatch") -> None:
    entries = batch.entries
    unique([entry.id for entry in entries], "word-wrap catalogue entry")
    unique([entry.candidate.id for entry in entries], "word-wrap catalogue candidate")
    unique([line.line_id for line in batch.census], "word-wrap census source line")
    if len(entries) > MAX_CATALOGUE_ENTRIES or len(
        _wire(batch.model_dump(mode="json")).encode()
    ) > (MAX_PRIVATE_CATALOGUE_BYTES):
        raise ValueError("Word-wrap private catalogue exceeds the complete bound")
    if batch.catalogue_sha256 != word_wrap_digest(entries):
        raise ValueError("Word-wrap whole catalogue digest differs")
    if batch.census_sha256 != word_wrap_digest(batch.census):
        raise ValueError("Word-wrap raw census digest differs")
    if [entry.id for entry in entries] != [f"w{index:05d}" for index in range(1, len(entries) + 1)]:
        raise ValueError("Word-wrap opaque global catalogue order differs")
    eligible = [item for item in batch.census if item.classification == "eligible"]
    if [item.entry_id for item in eligible] != [entry.id for entry in entries]:
        raise ValueError("Word-wrap census does not cover the complete eligible catalogue")
    for item, entry in zip(eligible, entries, strict=True):
        if (item.line_id, item.page, item.text_sha256, item.owner_id, item.next_line_id) != (
            entry.left.line_id,
            entry.left.page,
            entry.left.text_sha256,
            entry.owner_id,
            entry.right.line_id,
        ):
            raise ValueError("Word-wrap census source witness differs from its catalogue entry")
        if item.resolution != ("reuse" if entry.reused_authority is not None else "request"):
            raise ValueError("Word-wrap census reuse resolution differs")
    requested = [entry for entry in entries if entry.reused_authority is None]
    supplied = [entry for task in batch.tasks for entry in task.entries]
    if supplied != requested:
        raise ValueError("Word-wrap tasks must cover precisely the ordered uncategorized catalogue")
    for index, task in enumerate(batch.tasks):
        if (
            task.batch_index != index
            or task.batch_count != len(batch.tasks)
            or task.source_sha256 != batch.source_sha256
            or task.profile_id != batch.profile_id
            or task.policy != batch.policy
            or task.observation_sha256 != batch.observation_sha256
            or task.catalogue_sha256 != batch.catalogue_sha256
        ):
            raise ValueError("Word-wrap task differs from its whole catalogue batch")
