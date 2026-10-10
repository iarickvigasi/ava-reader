"""Independent OCR geometry; never an authority to rewrite accepted book text."""

import csv
import io
import math
import re
from dataclasses import dataclass

from ..contracts.source import Box
from .observations import PageObservation

ERROR = "PDF_ANNOTATION_WORD_GEOMETRY_REQUIRES_REVIEW"
HEADER = (
    "level",
    "page_num",
    "block_num",
    "par_num",
    "line_num",
    "word_num",
    "left",
    "top",
    "width",
    "height",
    "conf",
    "text",
)
MAX_BYTES = 4 * 1024 * 1024
MAX_WORDS = 10000


@dataclass(frozen=True)
class AnnotationWord:
    line: tuple[int, int, int]
    ordinal: int
    text: str
    confidence: float
    box: Box
    visible: bool = True


def parse_words(payload: bytes, page: PageObservation) -> list[AnnotationWord]:
    """Read single-image Tesseract TSV, preserving source order and exact Unicode."""
    if len(payload) > MAX_BYTES:
        raise ValueError(ERROR)
    try:
        rows = csv.reader(io.StringIO(payload.decode("utf-8", errors="strict")), delimiter="\t")
        if tuple(next(rows)) != HEADER:
            raise ValueError(ERROR)
        words: list[AnnotationWord] = []
        identities = set()
        previous: tuple[int, int, int, int] | None = None
        for count, row in enumerate(rows):
            if count >= 50000 or len(row) != len(HEADER):
                raise ValueError(ERROR)
            level, image, block, paragraph, line, ordinal = map(int, row[:6])
            if level not in range(1, 6) or image != 1:
                raise ValueError(ERROR)
            if level != 5:
                continue
            left, top, width, height = map(int, row[6:10])
            confidence = float(row[10])
            text = row[11]
            identity = (block, paragraph, line, ordinal)
            if (
                min(identity) < 1
                or identity in identities
                or (previous is not None and identity <= previous)
                or left < 0
                or top < 0
                or width < 1
                or height < 1
                or left + width > page.render_width
                or top + height > page.render_height
                or not math.isfinite(confidence)
                or not 0 <= confidence <= 100
                or len(text) > 500
                or (bool(text.strip()) and any(char.isspace() for char in text))
                or any(ord(char) < 32 or ord(char) == 127 for char in text)
                or len(words) >= MAX_WORDS
            ):
                raise ValueError(ERROR)
            identities.add(identity)
            previous = identity
            if not text.strip():
                # Tesseract emits whitespace-only word rows for detected border lines.
                # They carry no source word and cannot qualify annotation content.
                continue
            words.append(
                AnnotationWord(
                    line=(block, paragraph, line),
                    ordinal=ordinal,
                    text=text,
                    confidence=confidence,
                    box=Box(
                        coordinate_space="page_points_top_left",
                        x0=left * page.width_pt / page.render_width,
                        y0=top * page.height_pt / page.render_height,
                        x1=(left + width) * page.width_pt / page.render_width,
                        y1=(top + height) * page.height_pt / page.render_height,
                    ),
                )
            )
        return words
    except (UnicodeError, csv.Error, StopIteration, ValueError, OverflowError) as error:
        # Never leak OCR text or untrusted native diagnostics in general logs.
        raise ValueError(ERROR) from error


def exact_word_offsets(text: str, words: list[AnnotationWord]) -> list[tuple[int, int]]:
    """Match one complete observed line, allowing whitespace changes only.

    Offsets refer to the unchanged accepted string. Repeated identical lines,
    missing/extra words, punctuation changes and lookalikes require review.
    """
    if not words or len({word.line for word in words}) != 1:
        raise ValueError(ERROR)
    if len(text) > 200000:
        raise ValueError(ERROR)
    tokens = list(re.finditer(r"\S+", text))
    observed = [word.text for word in words]
    # Linear-time exact matching bounds repeated-word input; no fuzzy scoring.
    prefix = [0] * len(observed)
    matched = 0
    for index in range(1, len(observed)):
        while matched and observed[index] != observed[matched]:
            matched = prefix[matched - 1]
        if observed[index] == observed[matched]:
            matched += 1
        prefix[index] = matched
    starts = []
    matched = 0
    for index, token in enumerate(tokens):
        while matched and token.group() != observed[matched]:
            matched = prefix[matched - 1]
        if token.group() == observed[matched]:
            matched += 1
        if matched == len(observed):
            starts.append(index + 1 - len(observed))
            if len(starts) > 1:
                raise ValueError(ERROR)
            matched = prefix[matched - 1]
    if len(starts) != 1:
        raise ValueError(ERROR)
    return [(token.start(), token.end()) for token in tokens[starts[0] : starts[0] + len(words)]]
