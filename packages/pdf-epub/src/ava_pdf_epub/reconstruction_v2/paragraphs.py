"""Join adjacent same-column native lines with explicit line-wrap evidence and shifted spans."""

from .geometry import union
from .hanging_wrap import first_line_wrap, hanging_wrap
from .reading_order import Placement
from .segments import Segment


def join_paragraphs(ordered: list[Placement]) -> list[Placement]:
    output: list[Placement] = []
    for index, current in enumerate(ordered):
        following = ordered[index + 1] if index + 1 < len(ordered) else None
        previous = output[-1] if output else None
        if previous and _compatible(previous, current, following, ordered[index - 1]):
            output[-1] = Placement(
                _join(previous.segment, current.segment), previous.band, previous.column
            )
        else:
            output.append(current)
    return output


def _compatible(a: Placement, b: Placement, following: Placement | None, tail: Placement) -> bool:
    left, right = a.segment, b.segment
    if left.page != right.page or left.kind != right.kind or a.column != b.column:
        return False
    if a.column and a.band != b.band:
        return False
    if left.kind not in {"paragraph", "code", "verse", "quote"}:
        return False
    if left.structure_candidate or right.structure_candidate:
        return False
    height = max(1, right.box.y1 - right.box.y0)
    gap = right.box.y0 - left.box.y1
    leading = 0.95 if left.kind in {"code", "verse"} else 0.65
    if (
        left.kind == "paragraph"
        and right.text[:1].islower()
        and not left.text.endswith((".", "!", "?"))
    ):
        leading = 1.2
    shift = tail.segment.box.x0 - right.box.x0
    first_line = left.kind == "paragraph" and first_line_wrap(a, b, following, height)
    limit = 3 if first_line else 1.8
    if not 0 <= gap <= height * leading or abs(shift) > height * limit:
        return False
    if (
        left.kind == "paragraph"
        and right.box.x0 > tail.segment.box.x0 + height * 0.5
        and not hanging_wrap(a, b, following, height)
    ):
        return False
    if left.style and right.style and left.style.family != right.style.family:
        return False
    return True


def _join(left: Segment, right: Segment) -> Segment:
    separator = "\n" if left.kind in {"code", "verse"} else " "
    offset = len(left.text) + len(separator)
    return Segment.model_validate(
        {
            **left.model_dump(),
            "text": left.text + separator + right.text,
            "source_text": (left.source_text or left.text)
            + "\n"
            + (right.source_text or right.text),
            "box": union([left.box, right.box]).model_dump(),
            "native_line_ids": [*left.native_line_ids, *right.native_line_ids],
            "spans": [
                *[s.model_dump() for s in left.spans],
                *[
                    {**s.model_dump(), "start": s.start + offset, "end": s.end + offset}
                    for s in right.spans
                ],
            ],
        }
    )
