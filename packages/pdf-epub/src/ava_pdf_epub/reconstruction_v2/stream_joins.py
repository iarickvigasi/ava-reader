"""Join explicit continuation or visibly incomplete prose across column/page boundaries only."""

from ..contracts.layout_wrap import compound_wrap
from .assembly_state import AssemblyState
from .continuation_boundary import inferred_continuation
from .segments import Segment


def stream_joins(segments: list[Segment], state: AssemblyState) -> list[Segment]:
    output: list[Segment] = []
    previous_source = None
    for segment in segments:
        previous = output[-1] if output else None
        inferred = previous_source is not None and inferred_continuation(
            previous_source, segment, state
        )
        declared = previous and previous.continues_to_next and segment.continues_from_previous
        if previous_source and (previous_source.id, segment.id) in state.refined_joins:
            inferred = state.refined_joins[(previous_source.id, segment.id)]
            declared = inferred
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
            and previous.preserve_line_breaks == segment.preserve_line_breaks
            and (inferred or declared)
        ):
            separator = "\n" if previous.preserve_line_breaks else " "
            if (
                not previous.preserve_line_breaks
                and previous.method == segment.method == "native"
                and compound_wrap(
                    previous.text + "\n" + segment.text, len(previous.text), len(previous.text) + 1
                )
            ):
                separator = ""
            offset = len(previous.text) + len(separator)
            updated = previous.model_copy(
                update={
                    "text": previous.text + separator + segment.text,
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
        previous_source = segment
    if any(s.continues_from_previous or s.continues_to_next for s in output):
        raise ValueError("Unresolved prose continuation")
    return output
