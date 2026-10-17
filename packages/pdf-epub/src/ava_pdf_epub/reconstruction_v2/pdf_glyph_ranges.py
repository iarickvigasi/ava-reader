"""Bind native/legacy visual link callers to exact observed line offsets."""

from collections.abc import Mapping

from ..contracts.source import Box
from .geometry import area, overlap
from .native_line_offsets import NativeLineOffset, mapped_line_offset
from .observations import PageObservation
from .ocr_link_offset import visual_line_offset
from .segments import Segment


def glyph_ranges(
    page: PageObservation,
    segments: list[Segment],
    box: Box,
    *,
    corroborate_ocr: bool = False,
    source_line_maps: Mapping[str, NativeLineOffset] | None = None,
) -> list[tuple[str, int, int]]:
    ranges: list[tuple[str, int, int]] = []
    for line in page.lines:
        if not overlap(line.box, box):
            continue
        cursor = 0
        selected = []
        for glyph in line.glyphs:
            at = line.text.find(glyph.text, cursor)
            if at < cursor:
                raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
            cursor = at + len(glyph.text)
            fraction = overlap(glyph.box, box) / area(glyph.box)
            if fraction <= 0.05 or not glyph.text.strip():
                continue
            if fraction < 0.9 or not glyph.visible:
                raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
            selected.append((at, cursor))
        if not selected:
            continue
        owners = [s for s in segments if s.method == "native" and line.id in s.native_line_ids]
        source_text, source_start = line.text, 0
        visual_offsets: dict[str, int] = {}
        if not owners and corroborate_ocr:
            source_text = line.text.strip()
            source_start = len(line.text) - len(line.text.lstrip())
            # Shared caller/destination proof preserves OCR text authority.
            owners = []
            for candidate in segments:
                visual_at = visual_line_offset(page, line, candidate)
                if visual_at is not None:
                    owners.append(candidate)
                    visual_offsets[candidate.id] = visual_at
        if len(owners) != 1:
            raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
        owner = owners[0]
        mapped = (
            mapped_line_offset(line, owner, source_line_maps)
            if owner.method == "native"
            else visual_offsets.get(owner.id)
        )
        at = mapped if mapped is not None else owner.text.find(source_text)
        if mapped is None:
            if at < 0 or owner.text.find(source_text, at + 1) >= 0:
                raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
        for start, end in selected:
            start, end = start + at - source_start, end + at - source_start
            if ranges and ranges[-1][0] == owner.id:
                ident, previous, tail = ranges[-1]
                if tail == start or owner.text[tail:start].isspace():
                    ranges[-1] = (ident, previous, end)
                    continue
            ranges.append((owner.id, start, end))
    if not ranges:
        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
    return ranges
