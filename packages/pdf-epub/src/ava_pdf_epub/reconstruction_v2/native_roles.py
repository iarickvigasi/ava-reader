"""Keep printed markers as source evidence while identifying list and literal-line groups."""

from .list_markers import MARKER, marker_value
from .segments import Segment


def native_roles(segments: list[Segment]) -> list[Segment]:
    output = []
    indents: list[float] = []
    for index, segment in enumerate(segments):
        match = MARKER.match(segment.text) if segment.kind == "paragraph" else None
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
    for i in range(len(output) - 2):
        group = output[i : i + 3]
        if (
            all(s.kind == "paragraph" and len(s.text) < 65 for s in group)
            and all(
                0 < b.box.y0 - a.box.y1 < 10 and abs(a.box.x0 - b.box.x0) < 3
                for a, b in zip(group, group[1:], strict=False)
            )
            and all(s.text.rstrip().endswith((",", ";")) for s in group[:2])
        ):
            output[i : i + 3] = [s.model_copy(update={"kind": "verse"}) for s in group]
    return output
