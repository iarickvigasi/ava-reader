"""Keep printed list markers as source evidence; punctuation never proves poetry."""

from .list_markers import MARKER, marker_value
from .segments import Segment


def native_roles(segments: list[Segment], literal_rows: set[str] | None = None) -> list[Segment]:
    output = []
    indents: list[float] = []
    for index, segment in enumerate(segments):
        match = (
            MARKER.match(segment.text)
            if segment.kind == "paragraph" and segment.id not in (literal_rows or set())
            else None
        )
        if match:
            marker = match["marker"]
            following = (
                MARKER.match(segments[index + 1].text) if index + 1 < len(segments) else None
            )
            start = marker_value(marker, following["marker"] if following else None)
            x = segment.box.x0
            if not indents or abs(x - indents[0]) > 72:
                indents = [x]
            while len(indents) > 1 and x < indents[-1] - 5:
                indents.pop()
            if x > indents[-1] + 5:
                indents.append(x)
            if len(indents) > 3:
                raise ValueError("List exceeds supported nesting depth")
            segment = segment.model_copy(
                update={
                    "kind": "list_item",
                    "list_ordered": start is not None,
                    "list_start": start,
                    "list_depth": len(indents),
                }
            )
        else:
            indents = []
        output.append(segment)
    return output
