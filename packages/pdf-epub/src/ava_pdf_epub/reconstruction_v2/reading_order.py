"""Ordinary columns are one stream: complete left, then right, around spanning content."""

from dataclasses import dataclass

from .native_review import NativeReviewRequired
from .segments import Segment


@dataclass(frozen=True)
class Placement:
    segment: Segment
    band: int
    column: int


def reading_order(segments: list[Segment], width: float) -> list[Placement]:
    midpoint = width / 2
    left = [s for s in segments if s.box.x1 < midpoint]
    right = [s for s in segments if s.box.x0 > midpoint]
    paired = any(a.box.y0 < b.box.y1 and b.box.y0 < a.box.y1 for a in left for b in right)
    if not paired:
        return [Placement(s, index, 0) for index, s in enumerate(sorted(segments, key=_position))]
    spanning = [s for s in segments if s.box.x0 < midpoint < s.box.x1]
    pending = [s for s in segments if s not in spanning]
    result: list[Placement] = []
    band = 0
    for span in sorted(spanning, key=_position):
        above = [s for s in pending if s.box.y1 <= span.box.y0 + 0.1]
        remaining = [s for s in pending if s not in above]
        if any(s.box.y0 < span.box.y1 - 0.1 for s in remaining):
            raise NativeReviewRequired(
                "Overlapping full-width and column content requires layout review"
            )
        if above:
            result.extend(_columns(above, midpoint, band))
            band += 1
        result.append(Placement(span, band, 0))
        band += 1
        pending = remaining
    return [*result, *_columns(pending, midpoint, band)]


def _columns(segments: list[Segment], midpoint: float, band: int) -> list[Placement]:
    left = sorted((s for s in segments if s.box.x0 < midpoint), key=_position)
    right = sorted((s for s in segments if s.box.x0 >= midpoint), key=_position)
    if not left or not right:
        return [Placement(s, band, 0) for s in [*left, *right]]
    return [*[Placement(s, band, 1) for s in left], *[Placement(s, band, 2) for s in right]]


def _position(segment: Segment) -> tuple[float, float]:
    return segment.box.y0, segment.box.x0
