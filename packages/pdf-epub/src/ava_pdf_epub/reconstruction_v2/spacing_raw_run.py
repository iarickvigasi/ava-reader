"""Only complete, one-to-one source-owned raw ink can disambiguate generated boundary padding."""

import math
from typing import Any

from ..contracts.source import Box
from .geometry import overlap
from .observations import NativeLine, PageObservation

MAX_RAW_RUN_GLYPHS = 64


def generated_padding(text: Any, raw: Any, index: int, observation: PageObservation) -> bool:
    if (
        raw.FPDFText_GetUnicode(text, index) != 32
        or raw.FPDFText_IsGenerated(text, index) != 1
        or raw.FPDFText_IsHyphen(text, index) != 0
    ):
        return False
    left, bottom, right, top = text.get_charbox(index)
    return (
        all(math.isfinite(v) for v in (left, bottom, right, top))
        and left == right
        and bottom == top
        and 0 <= left <= observation.width_pt
        and 0 <= observation.height_pt - top <= observation.height_pt
    )


def source_owned_run(
    text: Any, raw: Any, start: int, line: NativeLine, observation: PageObservation
) -> bool:
    # Spaced/multi-scalar/ligature strings need their own proof. This fallback
    # grants no normalization or missing/interior-space authority.
    if (
        not 0 < len(line.glyphs) <= MAX_RAW_RUN_GLYPHS
        or "".join(g.text for g in line.glyphs) != line.text
        or any(
            len(g.text) != 1
            or ord(g.text) == 0
            or 0xD800 <= ord(g.text) <= 0xDFFF
            or not g.text.strip()
            or not g.visible
            or g.source_artifact
            for g in line.glyphs
        )
    ):
        return False
    for offset, glyph in enumerate(line.glyphs):
        index = start + offset
        code = raw.FPDFText_GetUnicode(text, index)
        if (
            type(code) is not int
            or code != ord(glyph.text)
            or raw.FPDFText_IsGenerated(text, index) != 0
            or raw.FPDFText_IsHyphen(text, index) != 0
        ):
            return False
        a, b, c, d = text.get_charbox(index)
        values = a, observation.height_pt - d, c, observation.height_pt - b
        if not all(math.isfinite(v) for v in values) or not (
            0 <= a < c <= observation.width_pt
            and 0 <= values[1] < values[3] <= observation.height_pt
        ):
            return False
        box = Box(
            coordinate_space="page_points_top_left",
            x0=values[0],
            y0=values[1],
            x1=values[2],
            y1=values[3],
        )
        if not (
            glyph.box.x0 <= box.x0 < box.x1 <= glyph.box.x1
            and glyph.box.y0 <= box.y0 < box.y1 <= glyph.box.y1
        ):
            return False
        owners = [
            (other.id, i)
            for other in observation.lines
            for i, peer in enumerate(other.glyphs)
            if overlap(box, peer.box)
        ]
        if owners != [(line.id, offset)]:
            return False
    return True
