"""Resolve explicit source chapter numbers without guessing from chapter order."""

from .assembly_state import AssemblyState
from .chapter_reference_context import chapter_reference_number
from .chapter_reference_target import chapter_reference_target
from .segments import ObservedSpan, Segment


def printed_chapter_reference(
    origin: str, span: ObservedSpan, segments: list[Segment], state: AssemblyState
) -> list[tuple[str, str]]:
    if (
        state.source_title_policy != "ava-frontmatter-title-1"
        or state.source_continuation_policy != "ava-source-continuation-presentation-1"
        or len({s.id for s in segments}) != len(segments)
    ):
        return []
    owner = next((s for s in segments if s.id == origin), None)
    number = chapter_reference_number(owner, span) if owner is not None else None
    if number is None:
        return []
    targets = [s for s in segments if s.id != origin and chapter_reference_target(s, number, state)]
    return [(targets[0].id, targets[0].id)] if len(targets) == 1 else []
