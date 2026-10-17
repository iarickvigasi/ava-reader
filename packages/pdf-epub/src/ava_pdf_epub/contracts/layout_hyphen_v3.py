"""Candidate2 keeps original physical pairs; source cuts are independently proved."""

import re
import unicodedata
from collections.abc import Sequence
from typing import Literal

from pydantic import Field, model_validator

from .common import Digest, Id, Record, document_digest, text_digest
from .layout_hyphen import LayoutHyphenLine
from .layout_hyphen_order import validate_hyphen_order
from .layout_prefix_cut_v3 import LayoutSourceCut
from .layout_source_cuts_v3 import exact_source_cut_text, source_cut_offset

LayoutOwnerRole = Literal["paragraph", "note", "list_item", "heading", "caption", "credit", "quote"]


class LayoutHyphenCandidateV2(Record):
    schema_version: Literal["ava-layout-hyphen-candidate-2"]
    id: Id
    source_sha256: Digest
    source_text_sha256: Digest
    source_start: int = Field(ge=0, le=200000)
    source_end: int = Field(gt=0, le=200000)
    left: LayoutHyphenLine
    right: LayoutHyphenLine
    role: LayoutOwnerRole
    boundary: Literal["line", "column", "page"]
    preserve_line_breaks: Literal[False]
    consecutive: Literal[True]

    @model_validator(mode="after")
    def source_order(self) -> "LayoutHyphenCandidateV2":
        validate_hyphen_order(
            self.left, self.right, self.source_start, self.source_end, self.boundary
        )
        return self


def candidate_digest_v2(candidate: LayoutHyphenCandidateV2) -> str:
    return document_digest(LayoutHyphenCandidateV2.model_validate(candidate.model_dump()))


def qualify_layout_hyphen_candidate_v2(
    source: str, supplied: LayoutHyphenCandidateV2, source_cuts: Sequence[LayoutSourceCut] = ()
) -> None:
    candidate = LayoutHyphenCandidateV2.model_validate(supplied.model_dump())
    if candidate.source_text_sha256 != text_digest(source):
        raise ValueError("Layout-hyphen original pair digest differs")
    left, right = candidate.left, candidate.right
    if left.source_start != 0 or right.source_end != len(source):
        raise ValueError("Layout-hyphen authority requires the complete original pair")
    if any(line.method != "native" for line in (left, right)):
        raise ValueError("Sparse word-wrap authority requires qualified native lines")
    for cut in source_cuts:
        line = left if cut.receipt.line_id == left.line_id else right
        if cut.receipt.line_id != line.line_id or cut.source_start != line.source_start:
            raise ValueError("Structural pair cut has no exact physical line owner")
    retained = exact_source_cut_text(source, source_cuts, role=candidate.role)
    start = source_cut_offset(candidate.source_start, source_cuts, len(source))
    end = source_cut_offset(candidate.source_end, source_cuts, len(source))
    letter = start - 1
    while letter >= 0 and unicodedata.combining(retained[letter]):
        letter -= 1
    if (
        not 0 < start < end < len(retained)
        or re.fullmatch(r"-[ \t]*(?:\r\n|\r|\n)[ \t]*", retained[start:end]) is None
        or letter < 0
        or not retained[letter].isalpha()
        or not retained[end].isalpha()
    ):
        raise ValueError("Layout-hyphen retained range is not the named hyphen and separator")
    if re.fullmatch(r"\r\n|\r|\n", source[left.source_end : right.source_start]) is None:
        raise ValueError("Layout-hyphen original lines lack one exact physical separator")
    if any(
        "\n" in source[line.source_start : line.source_end]
        or "\r" in source[line.source_start : line.source_end]
        for line in (left, right)
    ):
        raise ValueError("Layout-hyphen original witness is not one physical line")
