"""Choose one opening comparison; typography and chapter roles never establish its title role."""

import re

from .assembly_state import AssemblyState
from .metadata_scope import NON_TITLE_HEADINGS, metadata_scope
from .segments import Segment


def printed_title_candidate(segments: list[Segment]) -> Segment | None:
    retained = [s for s in segments if s.kind != "furniture"]
    view = AssemblyState()
    view.segments = {s.id: s for s in retained}
    view.blocks = [{"id": s.id, "kind": s.kind, "content": {"text": s.text}} for s in retained]
    if metadata_scope(view)[0] is not None:
        return None
    opening = [s for s in retained if s.page == 1][:16]
    first = next((s for s in opening if s.kind == "heading"), None)
    if first is None:
        return None
    text = first.text.strip()
    if (
        not 0 < len(first.text) <= 200
        or len(text.split()) > 24
        or text.casefold() in NON_TITLE_HEADINGS
        or re.match(
            r"^(?:\d+[.):]\s|[IVXLCDM]+[.)]\s|(?:chapter|section|part|розділ|частина)\s+(?:\d+|[IVXLCDM]+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third)\b)",
            text,
            re.I,
        )
    ):
        return None
    return first
