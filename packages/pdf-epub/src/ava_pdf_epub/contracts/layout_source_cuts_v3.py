"""Project exact ordered source-line prefixes; body characters are never inferred away."""

from collections.abc import Sequence

from .common import text_digest
from .layout_prefix_cut_v3 import LayoutSourceCut


def exact_source_cut_text(source: str, cuts: Sequence[LayoutSourceCut], *, role: str) -> str:
    parts, previous = [], 0
    for supplied in cuts:
        cut = LayoutSourceCut.model_validate(supplied.model_dump())
        start, end, receipt = cut.source_start, cut.source_end, cut.receipt
        if not previous <= start < end <= len(source):
            raise ValueError("Structural source cuts overlap or exceed source")
        if role != receipt.role or (start and source[start - 1] not in "\r\n"):
            raise ValueError("Structural source cut is not a supported owner line prefix")
        line_end = start
        while line_end < len(source) and source[line_end] not in "\r\n":
            line_end += 1
        if end >= line_end or source[start:end] != receipt.raw_prefix:
            raise ValueError("Structural source cut changes nonmarker source text")
        if text_digest(source[start:line_end]) != receipt.original_line_sha256:
            raise ValueError("Structural source cut original line digest differs")
        parts.append(source[previous:start])
        previous = end
    parts.append(source[previous:])
    return "".join(parts)


def source_cut_offset(offset: int, cuts: Sequence[LayoutSourceCut], length: int) -> int:
    if type(offset) is not int or not 0 <= offset <= length:
        raise ValueError("Source-cut offset outside original source")
    return offset - sum(max(0, min(offset, c.source_end) - c.source_start) for c in cuts)
