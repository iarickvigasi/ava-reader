"""Check exact physical-boundary bindings without guessing the intended spelling."""

import re
import unicodedata

from .common import text_digest, unique
from .layout_hyphen import LayoutHyphenCandidate, LayoutHyphenDisposition, candidate_digest


def qualify_layout_hyphens(
    source: str,
    source_sha256: str,
    candidates: list[LayoutHyphenCandidate],
    dispositions: list[LayoutHyphenDisposition],
) -> None:
    unique([c.id for c in candidates], "layout-hyphen candidate")
    unique([d.candidate_id for d in dispositions], "layout-hyphen disposition")
    decisions = {d.candidate_id: d for d in dispositions}
    if set(decisions) != {c.id for c in candidates}:
        raise ValueError("Layout-hyphen dispositions must cover exactly the named candidates")
    previous_end = 0
    source_text_sha256 = text_digest(source)
    for raw in candidates:
        candidate = LayoutHyphenCandidate.model_validate(raw.model_dump())
        if candidate.source_sha256 != source_sha256:
            raise ValueError("Layout-hyphen candidate belongs to another source")
        if candidate.source_text_sha256 != source_text_sha256:
            raise ValueError("Layout-hyphen candidate belongs to another literal observation")
        start, end = candidate.source_start, candidate.source_end
        if start < previous_end or not 0 < start < end < len(source):
            raise ValueError("Layout-hyphen ranges overlap or are outside the literal source")
        left, right = candidate.left, candidate.right
        if right.source_end > len(source):
            raise ValueError("Layout-hyphen source line is outside the literal observation")
        if (
            re.fullmatch(r"-[ \t]*(?:\r\n|\r|\n)[ \t]*", source[start:end]) is None
            or not _letter_before(source, start)
            or not source[end].isalpha()
            or re.fullmatch(r"[ \t]*", source[start + 1 : left.source_end]) is None
            or re.fullmatch(r"\r\n|\r|\n", source[left.source_end : right.source_start]) is None
            or re.fullmatch(r"[ \t]*", source[right.source_start : end]) is None
            or any("\n" in source[line.source_start : line.source_end] for line in (left, right))
            or any("\r" in source[line.source_start : line.source_end] for line in (left, right))
        ):
            raise ValueError("Layout-hyphen range is not the named hyphen and physical separator")
        decision = LayoutHyphenDisposition.model_validate(decisions[candidate.id].model_dump())
        if decision.candidate_sha256 != candidate_digest(candidate):
            raise ValueError("Layout-hyphen disposition belongs to another candidate")
        if decision.disposition == "unresolved":
            raise ValueError("Unresolved layout-hyphen reading cannot become canonical text")
        previous_end = end


def _letter_before(source: str, offset: int) -> bool:
    index = offset - 1
    while index >= 0 and unicodedata.combining(source[index]):
        index -= 1
    return index >= 0 and source[index].isalpha()
