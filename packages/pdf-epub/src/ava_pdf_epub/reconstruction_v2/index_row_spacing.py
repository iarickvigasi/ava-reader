"""Bound index row gaps with literal source whitespace and a terminal numeric suffix."""

from .index_entry_source import NUMERIC_WRAP
from .observations import Glyph, NativeLine


def index_row_spacing(
    line: NativeLine, values: list[tuple[int, Glyph]], positions: dict[int, tuple[int, int]]
) -> bool:
    gaps = [
        (a, b)
        for a, b in zip(values, values[1:], strict=False)
        if b[1].box.x0 - a[1].box.x1 > min(a[1].size, b[1].size) / 2
    ]
    if not gaps:
        return True
    if len(gaps) != 1:
        return False
    (left_i, left), (right_i, right) = gaps[0]
    boundary = positions[right_i][0]
    return (
        right.box.x0 - left.box.x1 <= min(left.size, right.size)
        and line.text[positions[left_i][1] : boundary].isspace()
        and any(c.isalpha() for c in line.text[positions[values[0][0]][0] : boundary])
        and NUMERIC_WRAP.fullmatch(line.text[boundary : positions[values[-1][0]][1]]) is not None
    )
