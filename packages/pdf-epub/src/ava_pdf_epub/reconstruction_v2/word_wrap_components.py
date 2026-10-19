"""Private source components keep recognized prose opaque inside mixed final owners."""

from typing import TYPE_CHECKING, Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record, text_digest, unique

if TYPE_CHECKING:
    from .word_wrap_source_contract import WordWrapOwner


class WordWrapSourceComponent(Record):
    id: Id
    method: Literal["native", "ocr"]
    original_text: str = Field(min_length=1, max_length=200000)
    original_sha256: Digest
    source_text: str = Field(min_length=1, max_length=200000)
    source_sha256: Digest
    native_line_ids: list[Id] = Field(max_length=10000)

    @model_validator(mode="after")
    def exact_component(self) -> "WordWrapSourceComponent":
        unique(self.native_line_ids, "word-wrap component source line")
        if self.original_sha256 != text_digest(self.original_text) or self.source_sha256 != (
            text_digest(self.source_text)
        ):
            raise ValueError("Word-wrap component text identity differs")
        if (self.method == "native") != bool(self.native_line_ids):
            raise ValueError("Word-wrap recognized component cannot supply native line IDs")
        if self.method == "ocr" and self.original_text != self.source_text:
            raise ValueError("Word-wrap recognized source component is protected opaque text")
        return self


def validate_word_wrap_components(owner: "WordWrapOwner") -> None:
    unique([component.id for component in owner.components], "word-wrap source component")
    if owner.original_text != "\n".join(c.original_text for c in owner.components):
        raise ValueError("Word-wrap owner original source components differ")
    if owner.source_text != "\n".join(c.source_text for c in owner.components):
        raise ValueError("Word-wrap owner retained source components differ")
    if [line.line_id for line in owner.lines] != [
        ident for component in owner.components for ident in component.native_line_ids
    ]:
        raise ValueError("Word-wrap source component native line coverage differs")
    lines = {line.line_id: line for line in owner.lines}
    cursor = 0
    for component in owner.components:
        local = [lines[ident] for ident in component.native_line_ids]
        if local and component.original_text != "\n".join(line.text for line in local):
            raise ValueError("Word-wrap native component changed its original source lines")
        for line in local:
            if line.source_start != cursor or line.source_end != cursor + len(line.text):
                raise ValueError("Word-wrap native line does not address its full source owner")
            cursor = line.source_end + 1
        if not local:
            cursor += len(component.original_text) + 1
