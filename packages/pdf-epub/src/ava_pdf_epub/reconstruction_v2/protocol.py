"""Bounded private protocol packets; settled provider responses contain no execution authority."""

from typing import Literal

from pydantic import Field

from ..contracts.common import Digest, Record
from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from .prepared import PreparedPage
from .recognition_contract import RecognitionResponse, RecognitionTask
from .refinement_contract import AnyRefinementResponse


class PrepareResult(Record):
    schema_version: Literal["ava-prepare-result-1"]
    profile_id: ProfileId = LEGACY_PROFILE
    source_sha256: Digest
    source_page_count: int = Field(ge=1, le=500)
    page_number: int = Field(ge=1, le=500)
    observation_sha256: Digest
    native_segment_count: int = Field(ge=0, le=2000)
    tasks: list[RecognitionTask] = Field(max_length=50)


class ReconstructionInput(Record):
    schema_version: Literal["ava-reconstruct-input-1"]
    profile_id: ProfileId = LEGACY_PROFILE
    source_sha256: Digest
    source_feature_policy: Literal["ava-ocr-source-features-1"] | None = Field(
        default=None, exclude_if=lambda v: v is None
    )
    responses: list[RecognitionResponse] = Field(max_length=25000)
    refinements: list[AnyRefinementResponse] = Field(default_factory=list, max_length=32)


def prepared_result(prepared: PreparedPage) -> PrepareResult:
    from ..contracts.common import document_digest

    return PrepareResult(
        schema_version="ava-prepare-result-1",
        profile_id=prepared.profile_id,
        source_sha256=prepared.source_sha256,
        source_page_count=prepared.source_page_count,
        page_number=prepared.observation.number,
        observation_sha256=document_digest(prepared.observation),
        native_segment_count=len(prepared.native_segments),
        tasks=prepared.tasks,
    )
