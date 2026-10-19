"""Sparse lexical authority is additive; historical Input4/Prepare3 stay closed."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Record
from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from .native_layout_policy import NativeLayoutPolicy
from .native_structure_contract import NativeStructureResponse, NativeStructureTask
from .native_structure_policy import NativeStructurePolicy
from .native_word_wrap_policy import NativeWordWrapPolicy
from .recognition_contract import RecognitionResponse, RecognitionTask
from .refinement_contract import AnyRefinementResponse, PrintedTitleResponse
from .word_wrap_contract import WordWrapResponse


class NativeWordWrapPrepareResult(Record):
    schema_version: Literal["ava-prepare-result-4"]
    source_layout_policy: NativeLayoutPolicy
    source_structure_policy: NativeStructurePolicy
    source_normalization_policy: NativeWordWrapPolicy
    profile_id: ProfileId = LEGACY_PROFILE
    source_sha256: Digest
    source_page_count: int = Field(ge=1, le=500)
    page_number: int = Field(ge=1, le=500)
    observation_sha256: Digest
    native_segment_count: int = Field(ge=0, le=2000)
    tasks: list[RecognitionTask | NativeStructureTask] = Field(max_length=50)


class NativeWordWrapReconstructionInput(Record):
    schema_version: Literal["ava-reconstruct-input-5"]
    source_layout_policy: NativeLayoutPolicy
    source_structure_policy: NativeStructurePolicy
    source_normalization_policy: NativeWordWrapPolicy
    profile_id: ProfileId = LEGACY_PROFILE
    source_sha256: Digest
    source_feature_policy: Literal["ava-ocr-source-features-1"]
    responses: list[RecognitionResponse] = Field(max_length=25000)
    native_structure_responses: list[NativeStructureResponse] = Field(max_length=25000)
    refinements: list[AnyRefinementResponse] = Field(default_factory=list, max_length=32)
    word_wrap_responses: list[WordWrapResponse] = Field(max_length=32)

    @model_validator(mode="after")
    def finite_authority(self) -> "NativeWordWrapReconstructionInput":
        if len(self.responses) + len(self.native_structure_responses) > 25000:
            raise ValueError("Combined native/recognition receipt count exceeds bound")
        if sum(isinstance(r, PrintedTitleResponse) for r in self.refinements) > 1:
            raise ValueError("Repeated printed-title receipt")
        return self
