"""Independent paired NativeLines corroborate a physical gutter, never word gaps alone."""

from .geometry import union
from .observations import Glyph, PageObservation
from .ocr_glyph_fragments import Fragment

Row = list[tuple[str, Glyph]]


def crosses_source_gutter(page: PageObservation, fragments: list[Fragment]) -> bool:
    glyphs = [(line.id, g) for line in page.lines for g in line.glyphs if g.text.strip()]
    if len(glyphs) > 40000:
        return True
    rows: list[Row] = []
    for value in sorted(glyphs, key=lambda v: (v[1].box.y0 + v[1].box.y1, v[1].box.x0)):
        glyph = value[1]
        if rows:
            first = rows[-1][0][1]
            delta = abs(glyph.box.y0 + glyph.box.y1 - first.box.y0 - first.box.y1) / 2
            if delta <= min(glyph.size, first.size) / 4:
                rows[-1].append(value)
                continue
        rows.append([value])
    witnesses = [(row, gaps) for row in rows if (gaps := _row_gaps(row))]
    selected = union([g.box for _, values in fragments for _, g in values])
    for i in range(len(witnesses) - 2):
        group = witnesses[i : i + 3]
        bounds = union([g.box for row, _ in group for _, g in row])
        if selected.y1 <= bounds.y0 or selected.y0 >= bounds.y1:
            continue
        size = max(g.size for row, _ in group for _, g in row)
        if any(
            b[0][0][1].box.y0 - a[0][0][1].box.y0 > 4 * size
            for a, b in zip(group, group[1:], strict=False)
        ):
            continue
        for left, right in _intersections(_intersections(group[0][1], group[1][1]), group[2][1]):
            if selected.x0 < left < right < selected.x1:
                return True
    return False


def _row_gaps(row: Row) -> list[tuple[float, float]]:
    lines: dict[str, list[Glyph]] = {}
    for ident, glyph in row:
        lines.setdefault(ident, []).append(glyph)
    boxes = [union([g.box for g in values]) for values in lines.values()]
    ordered = sorted((g for _, g in row), key=lambda g: (g.box.x0, g.box.x1))
    gaps = []
    right = ordered[0].box.x1
    for glyph in ordered[1:]:
        # Both sides require distinct complete source-line envelopes in this row.
        if (
            glyph.box.x0 > right
            and any(b.x1 <= right for b in boxes)
            and any(b.x0 >= glyph.box.x0 for b in boxes)
        ):
            gaps.append((right, glyph.box.x0))
        right = max(right, glyph.box.x1)
    return gaps


def _intersections(
    left: list[tuple[float, float]], right: list[tuple[float, float]]
) -> list[tuple[float, float]]:
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        lo, hi = max(left[i][0], right[j][0]), min(left[i][1], right[j][1])
        if hi > lo:
            result.append((lo, hi))
        if left[i][1] < right[j][1]:
            i += 1
        else:
            j += 1
    return result
