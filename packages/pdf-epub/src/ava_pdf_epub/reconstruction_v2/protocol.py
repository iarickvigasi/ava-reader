"""Bounded private protocol packets; settled provider responses contain no execution authority."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Record
from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from .prepared_native_layout import NativeLayoutPreparedPage
from .prepared_native_structure import NativeStructurePreparedPage
from .prepared_native_structure_v2 import NativeStructure2PreparedPage
from .prepared_native_word_wrap import NativeWordWrapPreparedPage
from .prepared_types import AnyPreparedPage
from .protocol_cell_geometry import CellGeometryReconstructionInput
from .protocol_continuation import ContinuationReconstructionInput
from .protocol_frontmatter_title import FrontmatterTitleReconstructionInput
from .protocol_native_layout import NativeLayoutPrepareResult, NativeLayoutReconstructionInput
from .protocol_native_structure import (
    NativeStructurePrepareResult,
    NativeStructureReconstructionInput,
)
from .protocol_native_structure_v2 import (
    NativeStructure2PrepareResult,
    NativeStructure2ReconstructionInput,
)
from .protocol_native_word_wrap import (
    NativeWordWrapPrepareResult,
    NativeWordWrapReconstructionInput,
)
from .protocol_recognition_geometry import RecognitionGeometryReconstructionInput
from .recognition_contract import RecognitionResponse, RecognitionTask
from .refinement_contract import (
    AnyRefinementResponse,
    HistoricalRefinementResponse,
    PrintedTitleResponse,
)


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
    refinements: list[HistoricalRefinementResponse] = Field(default_factory=list, max_length=32)


class PrintedTitleReconstructionInput(Record):
    schema_version: Literal["ava-reconstruct-input-2"]
    profile_id: ProfileId = LEGACY_PROFILE
    source_sha256: Digest
    source_feature_policy: Literal["ava-ocr-source-features-1"] | None = Field(
        default=None, exclude_if=lambda v: v is None
    )
    responses: list[RecognitionResponse] = Field(max_length=25000)
    refinements: list[AnyRefinementResponse] = Field(default_factory=list, max_length=32)

    @model_validator(mode="after")
    def title_authority(self) -> "PrintedTitleReconstructionInput":
        if sum(isinstance(response, PrintedTitleResponse) for response in self.refinements) != 1:
            raise ValueError(
                "Current reconstruction input requires exactly one printed-title receipt"
            )
        return self


AnyReconstructionInput = (
    ReconstructionInput
    | PrintedTitleReconstructionInput
    | NativeLayoutReconstructionInput
    | NativeStructureReconstructionInput
    | NativeWordWrapReconstructionInput
    | RecognitionGeometryReconstructionInput
    | FrontmatterTitleReconstructionInput
    | NativeStructure2ReconstructionInput
    | CellGeometryReconstructionInput
    | ContinuationReconstructionInput
)


def reconstruction_input(raw: object) -> AnyReconstructionInput:
    if isinstance(raw, dict) and raw.get("schema_version") == "ava-reconstruct-input-10":
        return ContinuationReconstructionInput.model_validate(raw)
    if isinstance(raw, dict) and raw.get("schema_version") == "ava-reconstruct-input-9":
        return CellGeometryReconstructionInput.model_validate(raw)
    if isinstance(raw, dict) and raw.get("schema_version") == "ava-reconstruct-input-8":
        return NativeStructure2ReconstructionInput.model_validate(raw)
    if isinstance(raw, dict) and raw.get("schema_version") == "ava-reconstruct-input-7":
        return FrontmatterTitleReconstructionInput.model_validate(raw)
    if isinstance(raw, dict) and raw.get("schema_version") == "ava-reconstruct-input-6":
        return RecognitionGeometryReconstructionInput.model_validate(raw)
    if isinstance(raw, dict) and raw.get("schema_version") == "ava-reconstruct-input-5":
        return NativeWordWrapReconstructionInput.model_validate(raw)
    if isinstance(raw, dict) and raw.get("schema_version") == "ava-reconstruct-input-4":
        return NativeStructureReconstructionInput.model_validate(raw)
    if isinstance(raw, dict) and raw.get("schema_version") == "ava-reconstruct-input-3":
        return NativeLayoutReconstructionInput.model_validate(raw)
    current = isinstance(raw, dict) and raw.get("schema_version") == "ava-reconstruct-input-2"
    return (
        PrintedTitleReconstructionInput.model_validate(raw)
        if current
        else ReconstructionInput.model_validate(raw)
    )


def prepared_result(
    prepared: AnyPreparedPage,
) -> (
    PrepareResult
    | NativeLayoutPrepareResult
    | NativeStructurePrepareResult
    | NativeWordWrapPrepareResult
    | NativeStructure2PrepareResult
):
    from ..contracts.common import document_digest

    if isinstance(prepared, NativeStructure2PreparedPage):
        return NativeStructure2PrepareResult(
            schema_version="ava-prepare-result-5",
            source_layout_policy=prepared.source_layout_policy,
            source_structure_policy=prepared.source_structure_policy,
            source_normalization_policy=prepared.source_normalization_policy,
            profile_id=prepared.profile_id,
            source_sha256=prepared.source_sha256,
            source_page_count=prepared.source_page_count,
            page_number=prepared.observation.number,
            observation_sha256=document_digest(prepared.observation),
            native_segment_count=len(prepared.native_segments),
            tasks=prepared.tasks,
        )
    if isinstance(prepared, NativeWordWrapPreparedPage):
        return NativeWordWrapPrepareResult(
            schema_version="ava-prepare-result-4",
            source_layout_policy=prepared.source_layout_policy,
            source_structure_policy=prepared.source_structure_policy,
            source_normalization_policy=prepared.source_normalization_policy,
            profile_id=prepared.profile_id,
            source_sha256=prepared.source_sha256,
            source_page_count=prepared.source_page_count,
            page_number=prepared.observation.number,
            observation_sha256=document_digest(prepared.observation),
            native_segment_count=len(prepared.native_segments),
            tasks=prepared.tasks,
        )
    if isinstance(prepared, NativeStructurePreparedPage):
        return NativeStructurePrepareResult(
            schema_version="ava-prepare-result-3",
            source_layout_policy=prepared.source_layout_policy,
            source_structure_policy=prepared.source_structure_policy,
            profile_id=prepared.profile_id,
            source_sha256=prepared.source_sha256,
            source_page_count=prepared.source_page_count,
            page_number=prepared.observation.number,
            observation_sha256=document_digest(prepared.observation),
            native_segment_count=len(prepared.native_segments),
            tasks=prepared.tasks,
        )
    if isinstance(prepared, NativeLayoutPreparedPage):
        return NativeLayoutPrepareResult(
            schema_version="ava-prepare-result-2",
            source_layout_policy=prepared.source_layout_policy,
            profile_id=prepared.profile_id,
            source_sha256=prepared.source_sha256,
            source_page_count=prepared.source_page_count,
            page_number=prepared.observation.number,
            observation_sha256=document_digest(prepared.observation),
            native_segment_count=len(prepared.native_segments),
            tasks=prepared.tasks,
        )

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
