"""Independent local OCR locates callers without rewriting accepted transcription."""

from ..contracts.source import Box
from .annotation_words import AnnotationWord, exact_word_offsets
from .geometry import area, overlap
from .segments import Segment


def scanned_ranges(
    segments: list[Segment], box: Box, words: list[AnnotationWord]
) -> list[tuple[str, int, int]]:
    """Locate link text without allowing local OCR to rewrite accepted transcription."""
    lines: dict[tuple[int, int, int], list[AnnotationWord]] = {}
    for word in words:
        lines.setdefault(word.line, []).append(word)
    result: list[tuple[str, int, int]] = []
    for line in lines.values():
        selected = []
        for ordinal, word in enumerate(line):
            fraction = overlap(word.box, box) / area(word.box)
            if fraction <= 0.05:
                continue
            if fraction < 0.9 or word.confidence < 85 or not word.visible:
                raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
            selected.append(ordinal)
        if not selected:
            continue
        candidates = []
        for item in segments:
            if item.method != "ocr" or item.kind in {"table", "figure", "furniture", "unsupported"}:
                continue
            if any(overlap(word.box, item.box) / area(word.box) < 0.9 for word in line):
                continue
            try:
                offsets = exact_word_offsets(item.text, line)
            except ValueError:
                continue
            candidates.append((item, offsets))
        if len(candidates) != 1:
            raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
        item, offsets = candidates[0]
        for ordinal in selected:
            start, end = offsets[ordinal]
            if result and result[-1][0] == item.id:
                ident, previous, tail = result[-1]
                if tail == start or item.text[tail:start].isspace():
                    result[-1] = (ident, previous, end)
                    continue
            result.append((item.id, start, end))
    if not result:
        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
    return result
