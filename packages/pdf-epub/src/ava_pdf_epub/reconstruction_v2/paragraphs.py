"""Join adjacent same-column native lines with explicit line-wrap evidence and shifted spans."""

from .geometry import union
from .reading_order import Placement
from .segments import Segment


def join_paragraphs(ordered: list[Placement]) -> list[Placement]:
    output: list[Placement] = []
    for current in ordered:
        previous = output[-1] if output else None
        if previous and _compatible(previous, current):
            output[-1] = Placement(
                _join(previous.segment, current.segment), previous.band, previous.column
            )
        else:
            output.append(current)
    return output


def _compatible(a: Placement, b: Placement) -> bool:
    left, right = a.segment, b.segment
    if left.page != right.page or left.kind != right.kind or a.column != b.column:
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
    if not 0 <= gap <= height * leading or abs(left.box.x0 - right.box.x0) > height * 1.8:
        return False
    if left.kind == "paragraph" and right.box.x0 > left.box.x0 + height * 0.5:
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
