"""Attach small raised/lowered glyphs to the nearest spatial line, not another column."""

from statistics import median

from .observations import Glyph


def glyph_rows(glyphs: list[Glyph], body: float) -> list[list[Glyph]]:
    regular = [g for g in glyphs if g.size >= body * 0.9]
    small = [g for g in glyphs if g.size < body * 0.9]
    parts = _parts(regular, body)
    unattached = []
    for glyph in small:
        matches = []
        for part in parts:
            baseline = median(g.box.y1 for g in part)
            dx = max(
                0,
                min(g.box.x0 for g in part) - glyph.box.x1,
                glyph.box.x0 - max(g.box.x1 for g in part),
            )
            dy = abs(glyph.box.y1 - baseline)
            if dx <= body * 1.8 and dy <= body * 0.85:
                matches.append((dy + dx * 2, part))
        if matches:
            min(matches, key=lambda pair: pair[0])[1].append(glyph)
        else:
            unattached.append(glyph)
    parts += _parts(unattached, body)
    parts = _rejoin(parts, body)
    return [
        sorted(part, key=lambda g: g.box.x0)
        for part in sorted(
            parts, key=lambda p: (min(g.box.y0 for g in p), min(g.box.x0 for g in p))
        )
    ]


def _parts(glyphs: list[Glyph], body: float) -> list[list[Glyph]]:
    rows: list[list[Glyph]] = []
    for glyph in sorted(glyphs, key=lambda g: (g.box.y1, g.box.x0)):
        row = next(
            (
                r
                for r in reversed(rows[-3:])
                if abs(glyph.box.y1 - median(g.box.y1 for g in r)) <= body * 0.3
            ),
            None,
        )
        if row is None:
            rows.append([glyph])
        else:
            row.append(glyph)
    parts = []
    for row in rows:
        fragments: list[list[Glyph]] = [[]]
        for glyph in sorted(row, key=lambda g: g.box.x0):
            if fragments[-1] and glyph.box.x0 - fragments[-1][-1].box.x1 > body * 1.8:
                fragments.append([])
            fragments[-1].append(glyph)
        parts += fragments
    return parts


def _rejoin(parts: list[list[Glyph]], body: float) -> list[list[Glyph]]:
    output: list[list[Glyph]] = []
    for part in sorted(
        parts, key=lambda p: (median(g.box.y1 for g in p), min(g.box.x0 for g in p))
    ):
        prior = output[-1] if output else None
        if (
            prior
            and abs(median(g.box.y1 for g in prior) - median(g.box.y1 for g in part)) < body * 0.3
            and (min(g.box.x0 for g in part) - max(g.box.x1 for g in prior) < body * 1.8)
        ):
            prior.extend(part)
        else:
            output.append(part)
    return output
