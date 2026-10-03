"""Bounded private protocol packets; settled provider responses contain no execution authority."""

from typing import Literal

from pydantic import Field

from ..contracts.common import Digest, Record
from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from .recognition_contract import RecognitionResponse, RecognitionTask
from .refinement_contract import BookRefinementResponse


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
    responses: list[RecognitionResponse] = Field(max_length=25000)
    refinements: list[BookRefinementResponse] = Field(default_factory=list, max_length=32)
