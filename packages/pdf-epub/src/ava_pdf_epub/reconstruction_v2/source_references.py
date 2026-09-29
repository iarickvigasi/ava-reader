"""Bind every explicit printed page reference to an observed source page and content anchor."""

import re

from .assembly_state import AssemblyState
from .reference_context import same_book_reference
from .segments import Segment

PAGE = re.compile(r"\b(?:pages?)\s+(\d+|[ivxlcdmIVXLCDM]+)\b", re.I)


def source_references(
    segments: list[Segment], folios: dict[str, int], state: AssemblyState
) -> None:
    first: dict[int, str] = {}
    for segment in segments:
        first.setdefault(segment.page, segment.id)
    for segment in segments:
        if segment.kind in {"figure", "separator", "code", "verse", "heading"}:
            continue
        for match in PAGE.finditer(segment.text):
            tail = segment.text[match.end() :]
            if re.match(r"\s*[-–,]\s*\d", tail):
                raise ValueError("Printed page range requires explicit source resolution")
            page = folios.get(match[1].casefold())
            target = first.get(page) if page is not None else None
            if not target:
                raise ValueError("Printed page reference has no unique observed source target")
            assert page is not None
            if same_book_reference(segment, match.start(), match.end(), page, segments):
                state.internal_targets.append((segment.id, match.start(), match.end(), target, 0))
