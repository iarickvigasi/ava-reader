"""Group exact native glyph style runs before allocating validated span records."""

from statistics import median
from typing import Literal

from ..contracts.styles import Style
from .font_traits import FontTraits, font_traits
from .native_review import NativeReviewRequired
from .observations import NativeLine
from .segments import ObservedSpan

Signature = tuple[FontTraits, Literal["super", "sub", "baseline"], float]


def line_spans(line: NativeLine) -> list[ObservedSpan]:
    sizes = [g.size for g in line.glyphs if g.text.strip()]
    if not sizes:
        return []
    body = median(sizes)
    baseline = median(g.box.y1 for g in line.glyphs if g.size >= body * 0.95)
    spans: list[ObservedSpan] = []
    offset = 0
    active: tuple[int, int, int, Signature] | None = None

    def emit(run: tuple[int, int, int, Signature]) -> None:
        start, end, index, (traits, vertical, relative) = run
        spans.append(
            ObservedSpan(
                start=start,
                end=end,
                style=Style(
                    id=f"{line.id}-g{index}",
                    family=traits.family,
                    bold=traits.bold,
                    italic=traits.italic,
                    small_caps=traits.small_caps,
                    vertical_align=vertical,
                    relative_size=relative,
                ),
            )
        )

    for index, glyph in enumerate(line.glyphs):
        at = line.text.find(glyph.text, offset)
        if at < offset:
            raise NativeReviewRequired("Native glyph cannot be aligned to visible transcription")
        end = at + len(glyph.text)
        offset = end
        if not glyph.text.strip():
            if active is not None:
                emit(active)
                active = None
            continue
        vertical: Literal["super", "sub", "baseline"] = (
            "super"
            if glyph.box.y1 < baseline - 2
            else ("sub" if glyph.box.y1 > baseline + 2 else "baseline")
        )
        signature = (font_traits(glyph.font), vertical, max(0.5, min(3.0, glyph.size / body)))
        if active is not None and active[1] == at and active[3] == signature:
            active = (active[0], end, active[2], signature)
        else:
            if active is not None:
                emit(active)
            active = (at, end, index, signature)
    if active is not None:
        emit(active)
    return spans
