"""Prepare bounded source-only comparisons from the complete final native-owner catalogue."""

from collections.abc import Sequence

from ..contracts.layout_hyphen_classification_v3 import NativeStructureHyphenClassificationReceipt
from ..contracts.profiles import ProfileId
from .observations import PageObservation
from .word_wrap_census import word_wrap_census
from .word_wrap_chunks import word_wrap_chunks
from .word_wrap_contract import WordWrapBatch, WordWrapTask
from .word_wrap_identity import word_wrap_digest, word_wrap_identifier
from .word_wrap_source_contract import WordWrapOwner


def prepare_word_wrap_catalogue(
    owners: Sequence[WordWrapOwner],
    pages: Sequence[PageObservation],
    *,
    source_sha256: str,
    profile_id: ProfileId,
    observation_sha256: str,
    prior_authorities: Sequence[NativeStructureHyphenClassificationReceipt] = (),
) -> WordWrapBatch:
    entries, census = word_wrap_census(owners, pages, source_sha256, prior_authorities)
    catalogue_sha256 = word_wrap_digest(entries)
    requested = [entry for entry in entries if entry.reused_authority is None]
    headers = dict(
        schema_version="ava-native-word-wrap-task-1",
        purpose="pdf_native_word_wrap",
        source_sha256=source_sha256,
        profile_id=profile_id,
        policy="ava-native-word-wrap-1",
        observation_sha256=observation_sha256,
        catalogue_sha256=catalogue_sha256,
    )
    chunks = word_wrap_chunks(requested, headers)
    tasks = []
    for index, chunk in enumerate(chunks):
        values = dict(
            **headers,
            task_id="pending",
            batch_index=index,
            batch_count=len(chunks),
            entries=[entry.model_dump() for entry in chunk],
        )
        values["task_id"] = word_wrap_identifier(values)
        tasks.append(WordWrapTask.model_validate(values))
    return WordWrapBatch(
        schema_version="ava-native-word-wrap-batch-1",
        source_sha256=source_sha256,
        profile_id=profile_id,
        policy="ava-native-word-wrap-1",
        observation_sha256=observation_sha256,
        catalogue_sha256=catalogue_sha256,
        census_sha256=word_wrap_digest(census),
        entries=entries,
        census=census,
        tasks=tasks,
    )
