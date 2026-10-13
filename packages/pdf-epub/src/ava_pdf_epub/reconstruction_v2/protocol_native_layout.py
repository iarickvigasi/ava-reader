"""Additive current layout packets; historical prepare/reconstruct schemas stay exact."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Record
from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from .native_layout_policy import NativeLayoutPolicy
from .recognition_contract import RecognitionResponse, RecognitionTask
from .refinement_contract import AnyRefinementResponse, PrintedTitleResponse


class NativeLayoutPrepareResult(Record):
    schema_version: Literal["ava-prepare-result-2"]
    source_layout_policy: NativeLayoutPolicy
    profile_id: ProfileId = LEGACY_PROFILE
    source_sha256: Digest
    source_page_count: int = Field(ge=1, le=500)
    page_number: int = Field(ge=1, le=500)
    observation_sha256: Digest
    native_segment_count: int = Field(ge=0, le=2000)
    tasks: list[RecognitionTask] = Field(max_length=50)


class NativeLayoutReconstructionInput(Record):
    schema_version: Literal["ava-reconstruct-input-3"]
    source_layout_policy: NativeLayoutPolicy
    profile_id: ProfileId = LEGACY_PROFILE
    source_sha256: Digest
    source_feature_policy: Literal["ava-ocr-source-features-1"]
    responses: list[RecognitionResponse] = Field(max_length=25000)
    refinements: list[AnyRefinementResponse] = Field(default_factory=list, max_length=32)

    @model_validator(mode="after")
    def finite_title_authority(self) -> "NativeLayoutReconstructionInput":
        # Initial Input3 has no receipts. Final assembly additionally compares the
        # exact source-computed task/receipt sets; B2 still requires its one title.
        if sum(isinstance(response, PrintedTitleResponse) for response in self.refinements) > 1:
            raise ValueError("Repeated printed-title receipt")
        return self
