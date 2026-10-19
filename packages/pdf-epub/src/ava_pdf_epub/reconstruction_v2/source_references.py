"""Bind every explicit printed page reference to an observed source page and content anchor."""

import re

from .assembly_state import AssemblyState
from .reference_context import same_book_reference
from .segments import Segment

PAGE = re.compile(r"\b(?:pages?)\s+(\d+|[ivxlcdmIVXLCDM]+)\b", re.I)


def source_references(
    segments: list[Segment],
    folios: dict[str, int],
    state: AssemblyState,
    printer_folio_ids: set[str] | None = None,
) -> None:
    first: dict[int, str] = {}
    for segment in segments:
        first.setdefault(segment.page, segment.id)
    for segment in segments:
        if segment.kind in {"figure", "separator", "code", "verse", "heading"} or segment.id in (
            printer_folio_ids or set()
        ):
            continue
        for match in PAGE.finditer(segment.text):
            tail = segment.text[match.end() :]
            printed_range = re.match(
                r"(?:\s*[-–,]\s*(?:\d+|[ivxlcdmIVXLCDM]+)\b)+"
                if printer_folio_ids is not None
                else r"\s*[-–,]\s*\d+",
                tail,
            )
            end = match.end() + (printed_range.end() if printed_range else 0)
            # Only the current profile supplies the qualified source-context set.
            if printer_folio_ids is not None and any(
                span.url and span.start <= match.start() and end <= span.end
                for span in segment.spans
            ):
                continue
            if printed_range:
                raise ValueError("Printed page range requires explicit source resolution")
            page = folios.get(match[1].casefold())
            target = first.get(page) if page is not None else None
            if not target:
                raise ValueError("Printed page reference has no unique observed source target")
            assert page is not None
            if same_book_reference(segment, match.start(), match.end(), page, segments):
                state.internal_targets.append((segment.id, match.start(), match.end(), target, 0))
