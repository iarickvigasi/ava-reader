"""Map every qualified native glyph to exact aside text without borrowing neighbouring ink."""

from collections import Counter

from ..contracts.source import Box
from .font_traits import FontTraits, font_traits
from .observations import NativeLine, PageObservation


def native_font_coverage(
    page: PageObservation, lines: list[NativeLine], box: Box, other_owners: set[str]
) -> list[tuple[int, int, FontTraits]] | None:
    if set(page.risks) - {"language_uncertain"} or not lines:
        return None
    ids = [line.id for line in lines]
    if len(set(ids)) != len(ids) or set(ids) & other_owners:
        return None
    counts = Counter(line.id for line in page.lines)
    if any(counts[ident] != 1 for ident in ids):
        return None
    result: list[tuple[int, int, FontTraits]] = []
    seen: set[tuple[str, float, float, float, float]] = set()
    base = 0
    for line in lines:
        if not _contains(box, line.box) or not line.glyphs or not line.text.strip():
            return None
        offset = 0
        for glyph in line.glyphs:
            bounds = glyph.box
            key = (glyph.text, bounds.x0, bounds.y0, bounds.x1, bounds.y1)
            face = font_traits(glyph.font)
            if (
                not glyph.visible
                or not _contains(line.box, bounds)
                or key in seen
                or face.family is None
            ):
                return None
            seen.add(key)
            if not line.text.startswith(glyph.text, offset):
                return None
            end = offset + len(glyph.text)
            result.append((base + offset, base + end, face))
            offset = end
        if offset != len(line.text):
            return None
        base += len(line.text) + 1  # native_graphics retains this exact newline separator.
    return result


def _contains(outer: Box, inner: Box) -> bool:
    return (
        outer.x0 <= inner.x0 < inner.x1 <= outer.x1 and outer.y0 <= inner.y0 < inner.y1 <= outer.y1
    )
