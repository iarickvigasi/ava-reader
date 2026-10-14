"""Private source-ID page checkpoints keep literal observations and their ownership."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Record
from ..contracts.layout_hyphen import LayoutHyphenCandidate, candidate_digest
from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from .native_colour_witness import NativeColourWitness, validate_witness
from .native_layout_policy import NativeLayoutPolicy
from .native_line_offsets import NativeLineOffset, mapped_native_ids, native_line_offsets
from .native_structure_contract import NativeStructureTask
from .native_structure_policy import NativeStructurePolicy
from .native_structure_source_validation import validate_source_ownership
from .native_structure_versions import NATIVE_TASK_TYPES
from .observations import PageObservation
from .observe_tables import TableObservation
from .recognition_contract import RecognitionTask
from .segments import Segment


class NativeStructurePreparedPage(Record):
    schema_version: Literal["ava-prepared-page-3"]
    source_layout_policy: NativeLayoutPolicy
    source_structure_policy: NativeStructurePolicy
    profile_id: ProfileId = LEGACY_PROFILE
    source_sha256: Digest
    source_byte_length: int = Field(ge=1, le=52428800)
    source_page_count: int = Field(ge=1, le=500)
    observation: PageObservation
    tables: list[TableObservation] = Field(max_length=100)
    native_segments: list[Segment] = Field(max_length=2000)
    tasks: list[RecognitionTask | NativeStructureTask] = Field(max_length=50)
    native_colour_witness: NativeColourWitness | None = Field(
        default=None, exclude_if=lambda v: v is None
    )
    native_line_maps: list[NativeLineOffset] = Field(default_factory=list, max_length=10000)
    layout_hyphen_candidates: list[LayoutHyphenCandidate] = Field(
        default_factory=list, max_length=10000
    )

    @model_validator(mode="after")
    def ownership(self) -> "NativeStructurePreparedPage":
        expected = native_line_offsets(
            self.observation, self.native_segments, mapped_native_ids(self.native_segments)
        )
        if expected != self.native_line_maps:
            raise ValueError("Native structure checkpoint line ownership differs")
        native = [t for t in self.tasks if isinstance(t, NATIVE_TASK_TYPES)]
        if native and (len(native) != 1 or len(self.tasks) != 1):
            raise ValueError("Native structure task must own its complete page")
        for task in self.tasks:
            if (
                task.source_sha256 != self.source_sha256
                or task.profile_id != self.profile_id
                or task.page_number != self.observation.number
            ):
                raise ValueError("Native structure checkpoint task identity differs")
        for task in native:
            from .native_structure_hyphen_candidates import source_hyphen_candidates

            expected_candidates = source_hyphen_candidates(
                self.observation, task.regions, self.source_sha256, self.profile_id
            )
            if expected_candidates != self.layout_hyphen_candidates or [
                (b.candidate_id, b.candidate_sha256) for b in task.boundaries
            ] != [(c.id, candidate_digest(c)) for c in expected_candidates]:
                raise ValueError("Native structure source boundary evidence differs")
            furniture = {
                ident for r in task.regions if r.source.role == "furniture" for ident in r.line_ids
            }
            validate_source_ownership(
                task, self.observation, self.native_segments, furniture=furniture
            )
        if not native and self.layout_hyphen_candidates:
            raise ValueError("Native source boundary has no selected structure task")
        validate_witness(self)
        return self
