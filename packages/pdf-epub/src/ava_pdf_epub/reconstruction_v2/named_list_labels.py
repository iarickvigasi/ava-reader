"""Compile qualified statement identifiers as literal labels only at final list assembly."""

import re

from .segments import Segment

_TOKEN = re.compile(r"^([A-Z]{1,3})([0-9⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]+)(?=\s|$)")
_ERROR = "Named list label lacks unambiguous source ordinal and script proof"


def named_list_label(segment: Segment) -> bool:
    match = _TOKEN.match(segment.text) if segment.kind == "list_item" else None
    if match is None:
        return False
    if (
        not match[2].isascii()
        or not segment.list_ordered
        or segment.list_start is None
        or segment.list_depth is None
        or not segment.text[match.end() :].strip()
    ):
        raise ValueError(_ERROR)
    suffix = _superscript_start(segment, match.end())
    digits = segment.text[match.start(2) : suffix]
    if not digits or (digits.lstrip("0") or "0") != str(segment.list_start):
        raise ValueError(_ERROR)
    for span in segment.spans:
        if suffix < match.end() and span.start < match.end() and span.end > suffix:
            if span.url or span.note_label or span.target_text:
                raise ValueError(_ERROR)
    return True


def _superscript_start(segment: Segment, end: int) -> int:
    base = segment.style.vertical_align if segment.style else None
    events: dict[int, list[tuple[str, int]]] = {0: [], end: []}
    for span in segment.spans:
        mode = span.style.vertical_align if span.style else None
        if mode is not None and span.start < end:
            events.setdefault(span.start, []).append((mode, 1))
            events.setdefault(min(end, span.end), []).append((mode, -1))
    active: dict[str, int] = {}
    suffix = end
    # Sweep source boundaries, not every span for every glyph. An explicit span
    # overrides inherited block style; conflicting inline observations refuse.
    for position in sorted(events):
        if position == end:
            break
        for event_mode, delta in events[position]:
            count = active.get(event_mode, 0) + delta
            if count:
                active[event_mode] = count
            else:
                active.pop(event_mode, None)
        if len(active) > 1:
            raise ValueError(_ERROR)
        vertical = next(iter(active), base or "baseline")
        if vertical == "super":
            suffix = min(suffix, position)
        elif vertical != "baseline" or suffix < end:
            raise ValueError(_ERROR)
    return suffix
