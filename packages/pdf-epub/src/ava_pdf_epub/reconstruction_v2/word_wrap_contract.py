"""Closed sparse native lexical task, response and complete catalogue batch contracts."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.profiles import ProfileId
from .word_wrap_fields import WordWrapCensusEntry, WordWrapDecision, WordWrapEntry


class WordWrapTask(Record):
    schema_version: Literal["ava-native-word-wrap-task-1"]
    task_id: Id
    purpose: Literal["pdf_native_word_wrap"]
    source_sha256: Digest
    profile_id: ProfileId
    policy: Literal["ava-native-word-wrap-1"]
    observation_sha256: Digest
    catalogue_sha256: Digest
    batch_index: int = Field(ge=0, le=31)
    batch_count: int = Field(ge=1, le=32)
    entries: list[WordWrapEntry] = Field(min_length=1, max_length=128)

    @model_validator(mode="after")
    def exact_identity(self) -> "WordWrapTask":
        from .word_wrap_identity import validate_word_wrap_task

        validate_word_wrap_task(self)
        return self


class WordWrapResponse(Record):
    schema_version: Literal["ava-native-word-wrap-response-1"]
    task_id: Id
    catalogue_sha256: Digest
    observation_sha256: Digest
    source_sha256: Digest
    decisions: list[WordWrapDecision] = Field(min_length=1, max_length=128)


class WordWrapBatch(Record):
    schema_version: Literal["ava-native-word-wrap-batch-1"]
    source_sha256: Digest
    profile_id: ProfileId
    policy: Literal["ava-native-word-wrap-1"]
    observation_sha256: Digest
    catalogue_sha256: Digest
    census_sha256: Digest
    entries: list[WordWrapEntry] = Field(max_length=4096)
    census: list[WordWrapCensusEntry] = Field(max_length=100000)
    tasks: list[WordWrapTask] = Field(max_length=32)

    @model_validator(mode="after")
    def complete_catalogue(self) -> "WordWrapBatch":
        from .word_wrap_batch_checks import validate_word_wrap_batch

        validate_word_wrap_batch(self)
        return self
