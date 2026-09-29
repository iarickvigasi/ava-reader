"""Map native per-glyph emphasis and vertical positions onto exact visible-text offsets."""

from statistics import median

from ..contracts.styles import Style
from .font_style import font_style
from .observations import NativeLine
from .segments import ObservedSpan


def line_spans(line: NativeLine) -> list[ObservedSpan]:
    spans: list[ObservedSpan] = []
    sizes = [g.size for g in line.glyphs if g.text.strip()]
    body = median(sizes) if sizes else 11
    baseline = median(g.box.y1 for g in line.glyphs if g.size >= body * 0.95)
    offset = 0
    for index, glyph in enumerate(line.glyphs):
        at = line.text.find(glyph.text, offset)
        if at < offset:
            raise ValueError("Native glyph cannot be aligned to visible transcription")
        end = at + len(glyph.text)
        observed = font_style([glyph], f"{line.id}-g{index}")
        vertical = (
            "super"
            if glyph.box.y1 < baseline - 2
            else ("sub" if glyph.box.y1 > baseline + 2 else "baseline")
        )
        value = {
            **observed.model_dump(),
            "vertical_align": vertical,
            "relative_size": max(0.5, min(3.0, glyph.size / body)),
        }
        style = Style.model_validate(value)
        if glyph.text.strip():
            spans.append(ObservedSpan(start=at, end=end, style=style))
        offset = end
    return _merge(spans)


def _merge(spans: list[ObservedSpan]) -> list[ObservedSpan]:
    merged: list[ObservedSpan] = []
    for span in spans:
        previous = merged[-1] if merged else None
        if (
            previous
            and previous.end == span.start
            and previous.style
            and span.style
            and (previous.style.model_dump(exclude={"id"}) == span.style.model_dump(exclude={"id"}))
        ):
            merged[-1] = previous.model_copy(update={"end": span.end})
        else:
            merged.append(span)
    return merged
