"""Compact Native2 requires the explicit current feature stack; Input7 stays closed."""

from typing import Literal

from pydantic import Field

from ..contracts.common import Digest, Record
from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from .native_layout_policy import NativeLayoutPolicy
from .native_structure_policy import NativeStructurePolicy2
from .native_structure_v2_contract import NativeStructureResponse2, NativeStructureTask2
from .native_word_wrap_policy import NativeWordWrapPolicy
from .protocol_frontmatter_title import FrontmatterTitleReconstructionInput
from .recognition_contract import RecognitionTask


class NativeStructure2PrepareResult(Record):
    schema_version: Literal["ava-prepare-result-5"]
    source_layout_policy: NativeLayoutPolicy
    source_structure_policy: NativeStructurePolicy2
    source_normalization_policy: NativeWordWrapPolicy
    profile_id: ProfileId = LEGACY_PROFILE
    source_sha256: Digest
    source_page_count: int = Field(ge=1, le=500)
    page_number: int = Field(ge=1, le=500)
    observation_sha256: Digest
    native_segment_count: int = Field(ge=0, le=2000)
    tasks: list[RecognitionTask | NativeStructureTask2] = Field(max_length=50)


class NativeStructure2ReconstructionInput(FrontmatterTitleReconstructionInput):
    schema_version: Literal["ava-reconstruct-input-8"]  # type: ignore[assignment]
    source_structure_policy: NativeStructurePolicy2  # type: ignore[assignment]
    native_structure_responses: list[NativeStructureResponse2] = Field(  # type: ignore[assignment]
        max_length=25000
    )
