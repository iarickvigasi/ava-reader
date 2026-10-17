"""Physical advance metrics tied to one actual interpreted font resource and text state."""

import math
from dataclasses import dataclass
from typing import Any

from pdfminer.pdffont import PDFType1Font


@dataclass(frozen=True)
class SpacingMetric:
    resource: int
    space: float
    em: float
    character_spacing: float
    state: tuple[float, ...] = ()


def spacing_metric(state: Any, char: Any) -> SpacingMetric | None:
    font, matrix = state.font, char.matrix
    if (
        type(font) is not PDFType1Font
        or state.wordspace != 0
        or state.rise != 0
        or state.render != 0
        or not all(
            math.isfinite(v) for v in (*matrix, state.charspace, state.scaling, state.fontsize)
        )
        or matrix[1] != 0
        or matrix[2] != 0
        or matrix[0] <= 0
        or matrix[3] <= 0
        or state.scaling <= 0
        or state.fontsize <= 0
    ):
        return None
    declared = [cid for cid in font.cid2unicode if cid in font.widths]
    encoded_spaces = {cid for cid in declared if font.cid2unicode[cid] == " "}
    decoded_spaces = {cid for cid in declared if font.to_unichr(cid) == " "}
    if len(encoded_spaces) != 1 or encoded_spaces != decoded_spaces:
        return None
    space_code = next(iter(encoded_spaces))
    width = font.char_width(space_code)
    scale = state.scaling * 0.01 * matrix[0]
    space, em, tracking = (
        width * state.fontsize * scale,
        state.fontsize * scale,
        state.charspace * scale,
    )
    if not all(math.isfinite(v) for v in (space, em, tracking)) or space <= 0 or em <= 0:
        return None
    return SpacingMetric(
        id(font),
        space,
        em,
        tracking,
        (state.fontsize, state.scaling, matrix[0], matrix[3]),
    )
