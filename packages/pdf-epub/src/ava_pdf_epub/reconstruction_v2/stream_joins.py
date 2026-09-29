"""Join explicit continuation or visibly incomplete prose across column/page boundaries only."""

import re

from .assembly_state import AssemblyState
from .segments import Segment


def stream_joins(segments: list[Segment], state: AssemblyState) -> list[Segment]:
    output: list[Segment] = []
    for segment in segments:
        previous = output[-1] if output else None
        boundary = previous and (
            previous.page != segment.page
            or segment.box.y0 < previous.box.y0
            and segment.box.x0 > previous.box.x0
        )
        native_join = (
            previous
            and previous.method == segment.method == "native"
            and boundary
            and (
                not re.search(r"[.!?:;][\"'’”)]*$", previous.text.rstrip())
                and bool(re.match(r"[a-z]", segment.text))
            )
        )
        declared = previous and previous.continues_to_next and segment.continues_from_previous
        if (
            previous
            and previous.kind in {"paragraph", "note"}
            and (
                segment.kind == "paragraph"
                or (
                    declared
                    and previous.kind == segment.kind == "note"
                    and previous.note_label == segment.note_label
                )
            )
            and (native_join or declared)
        ):
            offset = len(previous.text) + 1
            updated = previous.model_copy(
                update={
                    "text": previous.text + " " + segment.text,
                    "source_text": (previous.source_text or previous.text)
                    + "\n"
                    + (segment.source_text or segment.text),
                    "spans": [
                        *previous.spans,
                        *[
                            s.model_copy(update={"start": s.start + offset, "end": s.end + offset})
                            for s in segment.spans
                        ],
                    ],
                    "native_line_ids": [*previous.native_line_ids, *segment.native_line_ids],
                    "continues_to_next": segment.continues_to_next,
                }
            )
            state.aliases[segment.id] = (previous.id, offset)
            state.evidence[previous.id] += state.evidence[segment.id]
            state.segments[previous.id] = updated
            output[-1] = updated
        else:
            output.append(segment)
    if any(s.continues_from_previous or s.continues_to_next for s in output):
        raise ValueError("Unresolved prose continuation")
    return output
