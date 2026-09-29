"""Resolve a source-codepoint selection into canonical codepoints and DOM UTF-16."""

from .inline_text import TextValue
from .offsets import codepoint_range_to_utf16


def source_range_to_utf16(content: TextValue, start: int, end: int) -> tuple[int, int, int, int]:
    content = TextValue.model_validate(content.model_dump())
    source = content.normalization.source_text if content.normalization else content.text
    if type(start) is not int or type(end) is not int or not 0 <= start <= end <= len(source):
        raise ValueError("Source selection outside text")
    if content.normalization:
        a = content.normalization.source_boundary(start)
        b = content.normalization.source_boundary(end)
    else:
        a, b = start, end
    u, v = codepoint_range_to_utf16(content.text, a, b)
    return a, b, u, v
