"""Literal single-image OCR words in their actual encoded-image pixel frame."""

import csv
import math
from dataclasses import dataclass

from .annotation_tsv_rows import annotation_tsv_rows
from .annotation_words import HEADER

CELL_OCR_TSV_BYTES = 262144
ERROR = "CELL_OCR_EVIDENCE_INVALID"
BOUND = "CELL_OCR_EVIDENCE_BOUND"


@dataclass(frozen=True)
class CellOcrWord:
    identity: tuple[int, int, int, int]
    text: str
    confidence: float
    box: tuple[int, int, int, int]


def cell_ocr_words(payload: bytes, width: int, height: int) -> list[CellOcrWord]:
    if len(payload) > CELL_OCR_TSV_BYTES:
        raise ValueError(BOUND)
    if not payload:
        raise ValueError(ERROR)
    try:
        rows = annotation_tsv_rows(payload)
        if tuple(next(rows)) != HEADER:
            raise ValueError(ERROR)
        words: list[CellOcrWord] = []
        previous: tuple[int, int, int, int] | None = None
        for count, row in enumerate(rows):
            if count >= 10000:
                raise ValueError(BOUND)
            if len(row) != len(HEADER):
                raise ValueError(ERROR)
            level, page, block, paragraph, line, ordinal = map(int, row[:6])
            if level not in range(1, 6) or page != 1:
                raise ValueError(ERROR)
            if level != 5:
                continue
            left, top, w, h = map(int, row[6:10])
            confidence = float(row[10])
            text = row[11]
            identity = (block, paragraph, line, ordinal)
            if len(words) >= 2000:
                raise ValueError(BOUND)
            if (
                min(identity) < 1
                or (previous is not None and identity <= previous)
                or min(left, top) < 0
                or min(w, h) < 1
                or left + w > width
                or top + h > height
                or not math.isfinite(confidence)
                or not 0 <= confidence <= 100
                or len(text) > 500
                or any(ord(c) < 32 or ord(c) == 127 for c in text)
            ):
                raise ValueError(ERROR)
            previous = identity
            if not text.strip():
                continue  # Tesseract also reports non-text table border word rows.
            words.append(CellOcrWord(identity, text, confidence, (left, top, left + w, top + h)))
        return words
    except (UnicodeError, csv.Error, StopIteration, ValueError, OverflowError) as error:
        raise ValueError(BOUND if str(error) == BOUND else ERROR) from None
