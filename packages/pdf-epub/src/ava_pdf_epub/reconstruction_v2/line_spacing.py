"""Measure baseline spacing and the following paragraph gap with explicit generic font metrics."""

from statistics import median

from .observations import NativeLine


def baseline(line: NativeLine) -> float:
    size = median(g.size for g in line.glyphs)
    return median(g.box.y1 for g in line.glyphs if g.size >= size * 0.95)


def line_height(lines: list[NativeLine], size: float) -> float | None:
    values = [
        (baseline(b) - baseline(a)) / size
        for a, b in zip(lines, lines[1:], strict=False)
        if b.box.y0 > a.box.y0
    ]
    if not values:
        return None
    value = median(values)
    return max(0.5, min(3, value))
