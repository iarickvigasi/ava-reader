"""Private exact final-owner snapshots retain immutable, uncut native line witnesses."""

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record, text_digest, unique
from ..contracts.layout_prefix_cut_v3 import LayoutSourceCut
from ..contracts.source import Box
from .word_wrap_components import WordWrapSourceComponent


class WordWrapSourceLine(Record):
    line_id: Id
    page: int = Field(ge=1, le=500)
    region_id: Id
    box: Box
    text: str = Field(min_length=1, max_length=200000)
    text_sha256: Digest
    source_start: int = Field(ge=0, le=200000)
    source_end: int = Field(gt=0, le=200000)

    @model_validator(mode="after")
    def exact_line(self) -> "WordWrapSourceLine":
        if self.source_end - self.source_start != len(self.text):
            raise ValueError("Word-wrap line source range differs")
        if self.text_sha256 != text_digest(self.text) or "\n" in self.text or "\r" in self.text:
            raise ValueError("Word-wrap immutable source line differs")
        if self.box.coordinate_space != "page_points_top_left":
            raise ValueError("Word-wrap source line has no page geometry")
        return self


class WordWrapOwner(Record):
    id: Id
    role: str = Field(min_length=1, max_length=50)
    language: str = Field(min_length=1, max_length=50)
    source_text: str = Field(max_length=200000)
    original_text: str = Field(max_length=200000)
    cuts: list[LayoutSourceCut] = Field(default_factory=list, max_length=10000)
    lines: list[WordWrapSourceLine] = Field(min_length=1, max_length=10000)
    preserve_line_breaks: bool = False
    components: list[WordWrapSourceComponent] = Field(
        default_factory=list, max_length=10000, exclude_if=lambda value: not value
    )

    @model_validator(mode="after")
    def exact_owner(self) -> "WordWrapOwner":
        unique([line.line_id for line in self.lines], "word-wrap owner line")
        if self.components:
            from .word_wrap_components import validate_word_wrap_components

            validate_word_wrap_components(self)
        else:
            if self.original_text != "\n".join(line.text for line in self.lines):
                raise ValueError("Word-wrap owner does not reproduce ordered source lines")
            cursor = 0
            for line in self.lines:
                if line.source_start != cursor or line.source_end != cursor + len(line.text):
                    raise ValueError("Word-wrap owner original source ranges differ")
                cursor = line.source_end + 1
        from .word_wrap_cut_checks import validate_word_wrap_owner_cuts

        validate_word_wrap_owner_cuts(self)
        return self
