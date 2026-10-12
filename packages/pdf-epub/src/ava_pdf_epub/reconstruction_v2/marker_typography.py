"""Capture explicit marker observations before their printed prefix is removed."""

from typing import Any

from ..contracts.marker_styles import MARKER_STYLE_FIELDS
from ..contracts.styles import Style
from .segments import Segment


def marker_typography(segment: Segment, length: int) -> Style | None:
    if length <= 0:
        return None
    # Inline size is relative to the item's body, as it was before prefix removal.
    base = {
        key: getattr(segment.style, key)
        for key in MARKER_STYLE_FIELDS
        if key != "relative_size"
        and segment.style is not None
        and getattr(segment.style, key) is not None
    }
    events: dict[int, list[tuple[dict[str, Any], int]]] = {}
    # Inspect source spans once. Presentation is constant between their clipped
    # boundaries, so the sweep checks every marker glyph without rescanning it.
    for span in segment.spans:
        if span.start >= length or span.style is None:
            continue
        values = {
            key: getattr(span.style, key)
            for key in MARKER_STYLE_FIELDS
            if getattr(span.style, key) is not None
        }
        if values:
            events.setdefault(span.start, []).append((values, 1))
            events.setdefault(min(length, span.end), []).append((values, -1))
    if not events:
        return Style(id="source-marker", **base) if base else None
    events.setdefault(0, [])
    active: dict[str, dict[Any, int]] = {}
    observed: dict[str, Any] | None = None
    for position in sorted(events):
        if position == length:
            break
        for values, delta in events[position]:
            for key, value in values.items():
                counts = active.setdefault(key, {})
                count = counts.get(value, 0) + delta
                if count:
                    counts[value] = count
                else:
                    counts.pop(value)
        overrides = {}
        for key, counts in active.items():
            if len(counts) > 1:
                raise ValueError("Conflicting list marker presentation observations")
            if counts:
                overrides[key] = next(iter(counts))
        values = {**base, **overrides}
        if observed is not None and values != observed:
            raise ValueError("Mixed list marker glyph presentation is unsupported")
        observed = values
    return Style(id="source-marker", **observed) if observed else None
