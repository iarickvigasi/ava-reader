"""Exact native ownership plus complete-line raster geometry; never replacement text."""

import re
from collections.abc import Mapping
from pathlib import Path

from ..contracts.profiles import ProfileId
from ..contracts.source import Box
from .annotation_word_ocr import recognize_native_line_words
from .annotation_words import AnnotationWord, exact_word_offsets
from .geometry import area, overlap
from .native_line_offsets import NativeLineOffset, mapped_line_offset
from .observations import NativeLine, PageObservation
from .segments import Segment

ERROR = "PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW"
ContextCache = dict[tuple[str, float, float, float, float], list[AnnotationWord]]


def _fraction(box: Box, caller: Box) -> float:
    if area(box) <= 0:
        raise ValueError(ERROR)
    return overlap(box, caller) / area(box)


def _glyph_membership(line: NativeLine, caller: Box) -> set[int]:
    cursor = 0
    covered: set[int] = set()
    selected: set[int] = set()
    for glyph in line.glyphs:
        at = line.text.find(glyph.text, cursor)
        if at < cursor or line.text[cursor:at].strip():
            raise ValueError(ERROR)
        cursor = at + len(glyph.text)
        chars = {i for i in range(at, cursor) if not line.text[i].isspace()}
        if chars and not glyph.visible:
            raise ValueError(ERROR)
        covered.update(chars)
        fraction = _fraction(glyph.box, caller)
        if fraction > 0.05:
            # This is a refusal-only safeguard for an adjacent partial character,
            # never midpoint authority to accept a failed native envelope.
            x = (glyph.box.x0 + glyph.box.x1) / 2
            y = (glyph.box.y0 + glyph.box.y1) / 2
            if (
                chars
                and fraction < 0.9
                and not (caller.x0 <= x <= caller.x1 and caller.y0 <= y <= caller.y1)
            ):
                raise ValueError(ERROR)
            selected.update(chars)
    if covered != {i for i, c in enumerate(line.text) if not c.isspace()}:
        raise ValueError(ERROR)
    return selected


def native_caller_ranges(
    page: PageObservation,
    segments: list[Segment],
    caller: Box,
    scratch: Path,
    profile_id: ProfileId,
    mappings: Mapping[str, NativeLineOffset] | None,
    cache: ContextCache,
) -> list[tuple[str, int, int]]:
    if (
        page.risks
        or page.required_regions
        or page.rotation
        or not caller.within(page.width_pt, page.height_pt)
    ):
        raise ValueError(ERROR)
    if len({observed.id for observed in page.lines}) != len(page.lines) or len(
        {s.id for s in segments}
    ) != len(segments):
        raise ValueError(ERROR)
    lines = [
        observed
        for observed in page.lines
        if any(g.text.strip() and _fraction(g.box, caller) > 0.05 for g in observed.glyphs)
    ]
    if len(lines) != 1:
        raise ValueError(ERROR)
    line = lines[0]
    selected_glyphs = _glyph_membership(line, caller)
    owners = [s for s in segments if line.id in s.native_line_ids]
    if len(owners) != 1:
        raise ValueError(ERROR)
    owner = owners[0]
    if (
        owner.method != "native"
        or owner.page != page.number
        or owner.kind in {"table", "figure", "furniture", "unsupported"}
        or owner.source_marginal_furniture
    ):
        raise ValueError(ERROR)
    if any(s.method == "ocr" and s.text and overlap(s.box, caller) for s in segments):
        raise ValueError(ERROR)
    at = mapped_line_offset(line, owner, mappings)
    if at is None:
        at = owner.text.find(line.text)
        if at < 0 or owner.text.find(line.text, at + 1) >= 0:
            raise ValueError(ERROR)
    key = (line.id, caller.x0, caller.y0, caller.x1, caller.y1)
    if key not in cache:
        if len(cache) >= 2:
            del cache[next(iter(cache))]
        cache[key] = recognize_native_line_words(page, line, caller, scratch, profile_id)
    words = cache[key]
    if (
        not words
        or len({w.line for w in words}) != 1
        or [w.text for w in words] != re.findall(r"\S+", line.text)
    ):
        raise ValueError(ERROR)
    offsets = exact_word_offsets(line.text, words)
    selected: set[int] = set()
    ranges: list[tuple[str, int, int]] = []
    for word, (start, end) in zip(words, offsets, strict=True):
        if _fraction(word.box, line.box) < 0.9 or _fraction(word.box, owner.box) < 0.9:
            raise ValueError(ERROR)
        fraction = _fraction(word.box, caller)
        if fraction <= 0.05:
            continue
        if fraction < 0.9 or word.confidence < 85 or not word.visible:
            raise ValueError(ERROR)
        selected.update(i for i in range(start, end) if not line.text[i].isspace())
        start, end = start + at, end + at
        if ranges and owner.text[ranges[-1][2] : start].isspace():
            ranges[-1] = (owner.id, ranges[-1][1], end)
        else:
            ranges.append((owner.id, start, end))
    # A whole OCR word must neither add ignored punctuation nor silently drop a
    # partly intersecting adjacent native glyph. No trimming/center heuristic.
    if not ranges or selected != selected_glyphs:
        raise ValueError(ERROR)
    return ranges
