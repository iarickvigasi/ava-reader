"""Private sparse comparisons and complete physical-line-ending census records."""

from typing import Annotated, Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.layout_hyphen_classification_v3 import NativeStructureHyphenClassificationReceipt
from ..contracts.layout_hyphen_v3 import LayoutHyphenCandidateV2
from ..contracts.layout_prefix_cut_v3 import LayoutSourceCut
from .word_wrap_source_contract import WordWrapSourceLine

WordWrapId = Annotated[str, Field(pattern=r"^w[0-9]{5}$")]
WordWrapRole = Literal["paragraph", "note", "list_item", "heading", "caption", "credit", "quote"]
WordWrapDisposition = Literal["layout", "literal", "unresolved"]


class WordWrapEntry(Record):
    id: WordWrapId
    owner_id: Id
    owner_source_sha256: Digest
    owner_original_sha256: Digest
    source_pair: str = Field(min_length=3, max_length=200000)
    candidate: LayoutHyphenCandidateV2
    owner_source_offset: int = Field(ge=0, le=200000)
    original_owner_source_offset: int = Field(ge=0, le=200000)
    pair_cuts: list[LayoutSourceCut] = Field(default_factory=list, max_length=2)
    reused_authority: NativeStructureHyphenClassificationReceipt | None = None
    left: WordWrapSourceLine
    right: WordWrapSourceLine
    role: WordWrapRole
    language: str = Field(min_length=1, max_length=50)
    context: str = Field(min_length=3, max_length=256)

    @model_validator(mode="after")
    def exact_entry(self) -> "WordWrapEntry":
        from .word_wrap_entry_checks import validate_word_wrap_entry

        validate_word_wrap_entry(self)
        return self


class WordWrapDecision(Record):
    id: WordWrapId
    disposition: WordWrapDisposition


class WordWrapCensusEntry(Record):
    line_id: Id
    page: int = Field(ge=1, le=500)
    text_sha256: Digest
    owner_id: Id | None = None
    next_line_id: Id | None = None
    entry_id: WordWrapId | None = None
    resolution: Literal["request", "reuse"] | None = None
    classification: Literal["eligible", "preserved", "unsupported"]
    reason: Literal[
        "qualified",
        "preserved_line_breaks",
        "unsupported_role",
        "no_final_native_owner",
        "no_following_owner_line",
        "not_letter_pair",
        "outside_retained_body",
        "unsupported_boundary",
        "split_word_exceeds_context",
    ]

    @model_validator(mode="after")
    def eligible_identity(self) -> "WordWrapCensusEntry":
        if (self.classification == "eligible") != (
            self.entry_id is not None and self.reason == "qualified"
        ):
            raise ValueError("Word-wrap census eligibility differs")
        if self.classification == "eligible" and (
            self.owner_id is None or self.next_line_id is None or self.resolution is None
        ):
            raise ValueError("Eligible word-wrap census entry lacks source ownership")
        if self.classification != "eligible" and self.resolution is not None:
            raise ValueError("Unqualified word-wrap census entry has a classification resolution")
        return self
