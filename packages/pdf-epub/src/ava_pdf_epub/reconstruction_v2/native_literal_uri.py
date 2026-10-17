"""Prove a literal URI boundary from unchanged PDF target, native text and visual word."""

from typing import Any

from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget
from .geometry import overlap
from .observations import NativeLine


def raw_literal_uri(annotation: Any, target: NavigationTarget) -> str | None:
    action = annotation.get("/A")
    action = action.get_object() if hasattr(action, "get_object") else action
    if not isinstance(action, dict) or action.get("/S") != "/URI" or target.derived_scheme:
        return None
    raw = action.get("/URI")
    if not isinstance(raw, str) or not raw.startswith(("http://", "https://")) or raw != target.url:
        return None
    return raw


def literal_uri_range(
    line: NativeLine,
    caller: Box,
    native_selected: set[int],
    visual_selected: set[int],
    word_ranges: list[tuple[int, int]],
    uri: str | None,
) -> tuple[int, int] | None:
    # Called only after full-line OCR, word confidence, visibility and all geometry
    # gates have passed. This is text-boundary corroboration, not character OCR.
    if not uri or not uri.startswith(("http://", "https://")) or len(word_ranges) != 1:
        return None
    start, end = word_ranges[0]
    boundary = start + len(uri)
    if (
        line.text[start:end] != uri + ";"
        or native_selected != set(range(start, boundary))
        or visual_selected != set(range(start, end))
    ):
        return None
    cursor = 0
    suffix_seen = False
    for glyph in line.glyphs:
        at = line.text.find(glyph.text, cursor)
        cursor = at + len(glyph.text)
        if at <= boundary < cursor:
            # A shared ligature or even slight caller overlap cannot certify an
            # unlinked suffix. Never trim the native text or its punctuation.
            if at != boundary or cursor != end or overlap(glyph.box, caller):
                return None
            suffix_seen = True
    return (start, boundary) if suffix_seen else None
