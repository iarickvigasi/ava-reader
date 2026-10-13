"""Original pair authority and exact structural cuts precede canonical word projection."""

from typing import Literal

from pydantic import Field, model_validator

from .common import Record
from .layout_hyphen import candidate_digest
from .layout_hyphen_classification_v3 import (
    LayoutClassificationReceipt,
    NativeStructureHyphenClassificationReceipt,
)
from .layout_hyphen_v3 import (
    LayoutHyphenCandidateV2,
    candidate_digest_v2,
    qualify_layout_hyphen_candidate_v2,
)
from .layout_prefix_cut_v3 import LayoutSourceCut
from .layout_source_cuts_v3 import exact_source_cut_text, source_cut_offset


class LayoutHyphenAuthorityV3(Record):
    candidate: LayoutHyphenCandidateV2
    pair_source: str = Field(max_length=200000)
    pair_cuts: list[LayoutSourceCut] = Field(max_length=2)
    classification: LayoutClassificationReceipt
    original_source_offset: int = Field(ge=0, le=200000)
    source_offset: int = Field(ge=0, le=200000)
    retained_left_line_start: int = Field(ge=0, le=200000)
    retained_right_line_start: int = Field(ge=0, le=200000)

    @model_validator(mode="after")
    def original_authority(self) -> "LayoutHyphenAuthorityV3":
        candidate, receipt = self.candidate, self.classification
        qualify_layout_hyphen_candidate_v2(self.pair_source, candidate, self.pair_cuts)
        if receipt.candidate_id != candidate.id or receipt.decision == "unresolved":
            raise ValueError("Layout-hyphen classification is foreign or unresolved")
        if isinstance(receipt, NativeStructureHyphenClassificationReceipt):
            original = receipt.original_candidate
            expected = candidate.model_dump()
            expected["schema_version"] = "ava-layout-hyphen-candidate-1"
            if self.pair_cuts or expected != original.model_dump():
                raise ValueError(
                    "Native classification cannot be reused after source/role/cut changes"
                )
            digest = candidate_digest(original)
        else:
            digest = candidate_digest_v2(candidate)
        if receipt.source_candidate_sha256 != digest:
            raise ValueError("Layout-hyphen classification candidate digest differs")
        starts = [
            sum(
                c.source_end - c.source_start
                for c in self.pair_cuts
                if c.receipt.line_id == line.line_id
            )
            for line in (candidate.left, candidate.right)
        ]
        if starts != [self.retained_left_line_start, self.retained_right_line_start]:
            raise ValueError("Retained source-line starts differ from explicit cuts")
        return self

    def body_range(self) -> tuple[int, int, Literal["line_wrap", "layout_hyphen"]]:
        candidate = self.candidate
        start = source_cut_offset(candidate.source_start, self.pair_cuts, len(self.pair_source))
        end = source_cut_offset(candidate.source_end, self.pair_cuts, len(self.pair_source))
        literal = self.classification.decision == "literal"
        return (
            self.source_offset + start + literal,
            self.source_offset + end,
            ("line_wrap" if literal else "layout_hyphen"),
        )

    def retained_pair(self) -> str:
        return exact_source_cut_text(self.pair_source, self.pair_cuts, role=self.candidate.role)
