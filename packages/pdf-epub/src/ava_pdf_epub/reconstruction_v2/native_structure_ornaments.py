"""Prove isolated source ornament rows without replacing their individual native lines."""

import re
from collections.abc import Sequence

from ..contracts.source import Box
from .native_structure_fields import NativeStructureLine
from .observations import NativeLine

ORNAMENTS = frozenset("*·•—–-")
BASELINE_TOLERANCE = 0.1  # PDF page points, independent of render resolution.


def ornamental_separator(
    lines: Sequence[NativeStructureLine],
    *,
    width: float,
    height: float,
    other_boxes: Sequence[Box],
    other_lines: Sequence[NativeStructureLine],
) -> bool:
    # Retain the established classify_lines ornamental rule for complete lines.
    if lines and all(re.fullmatch(r"[\s*·•—–-]{3,}", line.text.strip()) for line in lines):
        return True
    return coherent_ornament_row(
        lines, width=width, height=height, other_boxes=other_boxes, other_lines=other_lines
    )


def coherent_ornament_row(
    lines: Sequence[NativeStructureLine],
    *,
    width: float,
    height: float,
    other_boxes: Sequence[Box],
    other_lines: Sequence[NativeStructureLine],
) -> bool:
    """A small centered body row, never isolated note callers or unrelated rows."""
    if not 3 <= len(lines) <= 12:
        return False
    first = lines[0]
    symbol = first.text.strip()
    if len(symbol) != 1 or symbol not in ORNAMENTS:
        return False
    if len(first.spans) != 1 or first.spans[0].style is None:
        return False
    signature = first.style.model_dump(exclude={"id"})
    span_signature = first.spans[0].style.model_dump(exclude={"id"})
    row_height = first.box.y1 - first.box.y0
    for line in lines:
        if (
            line.text.strip() != symbol
            or line.box.coordinate_space != "page_points_top_left"
            or abs(line.box.y0 - first.box.y0) > BASELINE_TOLERANCE
            or abs(line.box.y1 - first.box.y1) > BASELINE_TOLERANCE
            or line.box.x1 - line.box.x0 > row_height
            or line.style.model_dump(exclude={"id"}) != signature
            or line.style.family is None
            or line.style.vertical_align != "baseline"
            or line.style.relative_size is None
            or not 0.85 <= line.style.relative_size <= 1.2
            or len(line.spans) != 1
        ):
            return False
        span = line.spans[0]
        if (
            span.start != line.text.index(symbol)
            or span.end != span.start + 1
            or span.style is None
            or span.style.vertical_align != "baseline"
            or span.style.relative_size != 1
            or span.style.model_dump(exclude={"id"}) != span_signature
        ):
            return False
    gaps = [right.box.x0 - left.box.x1 for left, right in zip(lines, lines[1:], strict=False)]
    if (
        min(gaps) < row_height * 0.25
        or max(gaps) > row_height * 4
        or max(gaps) - min(gaps) > row_height * 0.1
    ):
        return False
    left, right = lines[0].box.x0, lines[-1].box.x1
    top, bottom = min(line.box.y0 for line in lines), max(line.box.y1 for line in lines)
    prose = [line for line in other_lines if sum(char.isalpha() for char in line.text) >= 5]
    above = sorted((line for line in prose if line.box.y1 <= top), key=lambda line: -line.box.y1)
    below = sorted((line for line in prose if line.box.y0 >= bottom), key=lambda line: line.box.y0)
    if not above or not below or first.style.relative_size is None:
        return False
    # Compare nearby body size instead of trusting a page median that the split
    # fragments themselves can dominate on a tiny page. Small callers stay prose.
    if any(
        line.style.family != first.style.family
        or line.style.relative_size is None
        or not 0.95 <= first.style.relative_size / line.style.relative_size <= 1.05
        for line in (above[0], below[0])
    ):
        return False
    return (
        0 < left < width / 2 < right < width
        and abs((left + right) / 2 - width / 2) <= row_height / 2
        and right - left <= width * 0.4
        and height * 0.08 <= top < bottom <= height * 0.92
        and not any(box.y0 < bottom and top < box.y1 for box in other_boxes)
    )


def matching_ornament_glyphs(lines: Sequence[NativeLine]) -> bool:
    """Routing additionally pins the private glyph font, point size and visible ink."""
    if not lines or any(len(line.glyphs) != 1 for line in lines):
        return False
    first = lines[0].glyphs[0]
    return bool(first.font) and all(
        glyph.visible
        and not glyph.source_artifact
        and glyph.text == line.text.strip()
        and glyph.box == line.box
        and glyph.font == first.font
        and glyph.size == first.size
        and glyph.paint_bold == first.paint_bold
        and glyph.paint_color == first.paint_color
        and glyph.paint_ink_color == first.paint_ink_color
        for line in lines
        for glyph in line.glyphs
    )
