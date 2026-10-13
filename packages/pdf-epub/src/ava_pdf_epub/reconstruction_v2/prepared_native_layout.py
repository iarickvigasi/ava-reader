"""Versioned private page authority for explicitly selected deterministic native layout."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Record
from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from .native_colour_witness import NativeColourWitness, validate_witness
from .native_layout_policy import NativeLayoutPolicy
from .native_line_offsets import NativeLineOffset, mapped_native_ids, native_line_offsets
from .observations import PageObservation
from .observe_tables import TableObservation
from .recognition_contract import RecognitionTask
from .segments import Segment


class NativeLayoutPreparedPage(Record):
    schema_version: Literal["ava-prepared-page-2"]
    source_layout_policy: NativeLayoutPolicy
    profile_id: ProfileId = LEGACY_PROFILE
    source_sha256: Digest
    source_byte_length: int = Field(ge=1, le=52428800)
    source_page_count: int = Field(ge=1, le=500)
    observation: PageObservation
    tables: list[TableObservation] = Field(max_length=100)
    native_segments: list[Segment] = Field(max_length=2000)
    tasks: list[RecognitionTask] = Field(max_length=50)
    native_colour_witness: NativeColourWitness | None = Field(
        default=None, exclude_if=lambda v: v is None
    )
    native_line_maps: list[NativeLineOffset] = Field(default_factory=list, max_length=10000)

    @model_validator(mode="after")
    def ownership(self) -> "NativeLayoutPreparedPage":
        if len({m.line_id for m in self.native_line_maps}) != len(self.native_line_maps):
            raise ValueError("Repeated native source line map")
        expected = native_line_offsets(
            self.observation, self.native_segments, mapped_native_ids(self.native_segments)
        )
        if expected != self.native_line_maps:
            raise ValueError("Native source line maps do not reproduce exact ordered ownership")
        validate_witness(self)
        return self
