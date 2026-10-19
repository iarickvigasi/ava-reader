"""A displaced native first line requires two consistent source continuation lines."""

from .reading_order import Placement


def first_line_wrap(a: Placement, b: Placement, following: Placement | None, height: float) -> bool:
    if following is None or a.column != following.column or (a.column and b.band != following.band):
        return False
    left, right, third = a.segment, b.segment, following.segment
    if any(
        s.kind != "paragraph" or s.structure_candidate or len(s.native_line_ids) != 1
        for s in (left, right, third)
    ):
        return False
    if any(s.method != "native" or s.page != left.page for s in (left, right, third)):
        return False
    if right.style and third.style and right.style.family != third.style.family:
        return False
    return (
        abs(right.box.x0 - third.box.x0) <= height * 0.15
        and 0 <= third.box.y0 - right.box.y1 <= height * 0.65
    )


def hanging_wrap(a: Placement, b: Placement, following: Placement | None, height: float) -> bool:
    return (
        b.segment.text[:1].islower()
        and not a.segment.text.endswith((".", "!", "?"))
        and first_line_wrap(a, b, following, height)
    )
