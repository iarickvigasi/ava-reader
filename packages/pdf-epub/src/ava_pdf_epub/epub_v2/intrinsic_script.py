"""Render finite intrinsic script digits once, without changing canonical characters."""

import unicodedata

from ..contracts.book import CanonicalBookV2
from ..contracts.graph_index import index_book
from ..contracts.graph_links import TEXT_NODES
from ..contracts.inline_text import InlineSpan
from ..contracts.styles import Style

FAMILIES = {
    c: name for name, digits in {"super": "⁰¹²³⁴⁵⁶⁷⁸⁹", "sub": "₀₁₂₃₄₅₆₇₈₉"}.items() for c in digits
}


def intrinsic_family(text: str, offset: int) -> str | None:
    if offset >= len(text):
        return None
    family = FAMILIES.get(text[offset])
    if family is None:
        return None
    # Do not introduce a style boundary through a combining/joined sequence.
    neighbors = text[max(0, offset - 1) : offset] + text[offset + 1 : offset + 2]
    if any(
        unicodedata.category(c).startswith("M") or unicodedata.category(c) == "Cf"
        for c in neighbors
    ):
        return None
    return family


def script_boundaries(text: str) -> set[int]:
    positions: set[int] = set()
    previous = None
    for offset in range(len(text) + 1):
        family = intrinsic_family(text, offset)
        if family != previous:
            positions.add(offset)
        previous = family
    return positions


def matching_script(
    text: str, offset: int, active: list[InlineSpan], styles: dict[str, Style]
) -> bool:
    family = intrinsic_family(text, offset)
    if family is None:
        return False
    alignments = {
        styles[s.style_id].vertical_align
        for s in active
        if s.style_id is not None and styles[s.style_id].vertical_align is not None
    }
    # Conflicting nested baseline/opposite placement stays on its historical path.
    return alignments == {family}


def needs_script_projection(book: CanonicalBookV2) -> bool:
    nodes, _ = index_book(book)
    styles = {s.id: s for s in book.styles}
    for node in nodes.values():
        if not isinstance(node, TEXT_NODES):
            continue
        text, spans = node.content.text, node.content.spans
        positions = script_boundaries(text) | {s.start for s in spans} | {s.end for s in spans}
        for offset in positions:
            if intrinsic_family(text, offset) is None:
                continue
            active = [s for s in spans if s.start <= offset < s.end]
            if matching_script(text, offset, active, styles):
                return True
    return False
