"""Compose named deletions with an existing exact source map, without realignment."""

from typing import Literal

from ..contracts.layout_normalization import LayoutNormalizationSegment
from ..contracts.normalization import NormalizationMap
from .layout_hyphen_offsets import layout_hyphen_offset

LayoutChangeKind = Literal["line_wrap", "layout_hyphen"]


def layout_hyphen_segments(
    base: NormalizationMap,
    source_ranges: list[tuple[int, int, LayoutChangeKind, str]],
    removals: list[tuple[int, int]],
    length: int,
) -> list[LayoutNormalizationSegment]:
    result = []
    cursor = 0
    for start, end, kind, candidate_id in source_ranges:
        result.extend(_retained(base, cursor, start, removals, length))
        at = layout_hyphen_offset(base.source_boundary(start), removals, length)
        result.append(
            LayoutNormalizationSegment(
                source_start=start,
                source_end=end,
                canonical_start=at,
                canonical_end=at,
                kind=kind,
                candidate_id=candidate_id,
            )
        )
        cursor = end
    result.extend(_retained(base, cursor, len(base.source_text), removals, length))
    return result


def _retained(
    base: NormalizationMap,
    start: int,
    end: int,
    removals: list[tuple[int, int]],
    length: int,
) -> list[LayoutNormalizationSegment]:
    result = []
    for item in base.segments:
        first, last = max(start, item.source_start), min(end, item.source_end)
        if first >= last:
            continue
        a = layout_hyphen_offset(base.source_boundary(first), removals, length)
        b = layout_hyphen_offset(base.source_boundary(last), removals, length)
        result.append(
            LayoutNormalizationSegment(
                source_start=first,
                source_end=last,
                canonical_start=a,
                canonical_end=b,
                kind=item.kind,
            )
        )
    return result
