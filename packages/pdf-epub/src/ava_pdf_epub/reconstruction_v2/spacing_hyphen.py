"""Qualify PDFium's terminal hyphen marker against the original literal source glyph."""

import math
from typing import Any

from .geometry import overlap
from .native_line_visibility import complete_visible_line
from .observations import NativeLine, PageObservation


def hyphen_markers(text: Any, raw: Any, height: float) -> list[tuple[float, float, float, float]]:
    count = text.count_chars()
    if type(count) is not int or not 0 <= count <= 200000:
        raise RuntimeError("Second-decoder character bound exceeded")
    markers = []
    for index in range(count):
        if raw.FPDFText_GetUnicode(text, index) != 2 or raw.FPDFText_IsHyphen(text, index) != 1:
            continue
        left, bottom, right, top = text.get_charbox(index)
        box = (left, height - top, right, height - bottom)
        if all(math.isfinite(v) for v in box) and box[0] < box[2] and box[1] < box[3]:
            markers.append(box)
    return markers


def corroborate_terminal_hyphen(
    line: NativeLine,
    proposed: str,
    markers: list[tuple[float, float, float, float]],
    observation: PageObservation,
) -> str:
    if (
        not proposed.endswith("\x02")
        or proposed.count("\x02") != 1
        or not line.text.endswith("-")
        or not line.glyphs
        or line.glyphs[-1].text != "-"
        or not complete_visible_line(line)
        or any(g.source_artifact for g in line.glyphs)
        or sum(other.id == line.id for other in observation.lines) != 1
        or not any(other == line for other in observation.lines)
    ):
        return proposed
    from ..contracts.source import Box

    candidates = [
        Box(coordinate_space="page_points_top_left", x0=a, y0=b, x1=c, y1=d)
        for a, b, c, d in markers
        if 0 <= a < c <= observation.width_pt and 0 <= b < d <= observation.height_pt
    ]
    inside = [box for box in candidates if overlap(box, line.box)]
    if len(inside) != 1:
        return proposed
    box, glyph = inside[0], line.glyphs[-1]
    if (
        not (
            glyph.box.x0 <= box.x0 < box.x1 <= glyph.box.x1
            and glyph.box.y0 <= box.y0 < box.y1 <= glyph.box.y1
        )
        or any(overlap(box, peer.box) for peer in line.glyphs[:-1])
        or any(other.id != line.id and overlap(box, other.box) for other in observation.lines)
    ):
        return proposed
    # Only the corroborator's explicit marker changes. The original literal
    # source hyphen and every native glyph/map remain intact. Full-row spacing
    # conservation and independent physical word-gap gates run afterward.
    return proposed[:-1] + "-"
