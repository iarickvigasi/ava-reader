"""Optional presentation of an existing prefix; never a second copy of its text."""

from pydantic import Field

from .common import Record
from .inline_text import TextValue


class LiteralLabelLayout(Record):
    prefix_end: int = Field(gt=0, le=200000)
    column_em: float = Field(ge=0.5, le=6)


def validate_literal_label(layout: LiteralLabelLayout, content: TextValue) -> None:
    end, text = layout.prefix_end, content.text
    if not (
        end < len(text)
        and text[:end].strip()
        and text[end - 1].isspace()
        and not text[end].isspace()
    ):
        raise ValueError("Literal label boundary must include its separator before body text")
    if any(s.link and 0 < s.start < end < s.end for s in content.spans):
        raise ValueError("Literal label column partially crosses a semantic link")
