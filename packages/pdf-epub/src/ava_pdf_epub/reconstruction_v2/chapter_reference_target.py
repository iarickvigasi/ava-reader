"""Check an explicitly numbered native compound against corroborated source navigation."""

import hashlib
import re

from .assembly_state import AssemblyState
from .navigation_alias_key import navigation_alias_key
from .segments import Segment


def chapter_reference_target(segment: Segment, number: str, state: AssemblyState) -> bool:
    pieces = state.compound_heading_sources.get(segment.id, ())
    if (
        len(pieces) < 2
        or segment.kind != "heading"
        or not segment.chapter_start
        or segment.chapter_role != "bodymatter"
        or segment.heading_level != 1
        or segment.method != "native"
        or segment.text != "\n".join(p.text for p in pieces)
        or segment.source_text != "\n".join(p.source_text or p.text for p in pieces)
        or segment.native_line_ids != [line for p in pieces for line in p.native_line_ids]
        or any(p.method != "native" or p.page != segment.page for p in pieces)
    ):
        return False
    first = pieces[0]
    if (
        first.id != segment.id
        or first.kind != "heading"
        or first.source_text != first.text
        or first.text != number
        or re.fullmatch(r"[1-9][0-9]{0,2}", first.text) is None
        or len(first.native_line_ids) != 1
        or first.note_label
        or first.related_to
        or any(s.url or s.note_label or s.target_text for s in first.spans)
    ):
        return False
    ident = first.native_line_ids[0]
    entry = state.native_line_maps.get(ident)
    if entry is None or (
        entry.line_id != ident
        or entry.segment_id != segment.id
        or entry.start != 0
        or entry.end != len(number)
        or entry.text_sha256 != hashlib.sha256(number.encode()).hexdigest()
        or segment.text[entry.start : entry.end] != number
    ):
        return False
    key = navigation_alias_key(segment.text)
    direct = any(
        target == segment.id
        and page == segment.page
        and depth == 0
        and navigation_alias_key(title) == key
        for (title, page, depth), target in state.source_outline_targets.items()
    )
    alias = any(
        page == segment.page and depth == 0 and navigation_alias_key(title) == key
        for title, page, depth in state.source_outline_aliases
    )
    return direct or alias
