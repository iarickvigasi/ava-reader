"""Versioned private page authority for explicitly selected deterministic native layout."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Record
from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from .native_layout_policy import NativeLayoutPolicy
from .native_line_offsets import NativeLineOffset, mapped_line_offset
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
    native_line_maps: list[NativeLineOffset] = Field(default_factory=list, max_length=10000)

    @model_validator(mode="after")
    def ownership(self) -> "NativeLayoutPreparedPage":
        if len({m.line_id for m in self.native_line_maps}) != len(self.native_line_maps):
            raise ValueError("Repeated native source line map")
        lines = {line.id: line for line in self.observation.lines}
        for mapping in self.native_line_maps:
            owners = [s for s in self.native_segments if mapping.line_id in s.native_line_ids]
            if len(owners) != 1 or mapping.line_id not in lines:
                raise ValueError("Native source line map has no unique owner")
            mapped_line_offset(lines[mapping.line_id], owners[0], {mapping.line_id: mapping})
        return self
