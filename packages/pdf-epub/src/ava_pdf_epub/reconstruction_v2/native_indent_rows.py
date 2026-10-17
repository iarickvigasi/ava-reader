"""Incomplete or multiply owned native ink cannot qualify indentation or a raw font."""

import re
from collections import Counter
from dataclasses import dataclass

from ..contracts.source import Box
from .observations import Glyph, NativeLine, PageObservation
from .segments import Segment

GlyphKey = tuple[str, str, float, float, float, float, float]


def glyph_key(glyph: Glyph) -> GlyphKey:
    b = glyph.box
    return glyph.text, glyph.font, glyph.size, b.x0, b.y0, b.x1, b.y1


@dataclass(frozen=True)
class NativeIndentRows:
    lines: dict[str, NativeLine]
    owners: Counter[str]
    glyph_owners: Counter[GlyphKey]


def indent_rows(page: PageObservation, segments: list[Segment]) -> NativeIndentRows:
    counts = Counter(row.id for row in page.lines)
    return NativeIndentRows(
        {r.id: r for r in page.lines if counts[r.id] == 1},
        Counter(i for s in segments for i in s.native_line_ids),
        Counter(glyph_key(g) for row in page.lines for g in row.glyphs if g.text.strip()),
    )


def contained(outer: Box, inner: Box) -> bool:
    return (
        outer.coordinate_space == inner.coordinate_space == "page_points_top_left"
        and outer.x0 <= inner.x0 <= inner.x1 <= outer.x1
        and outer.y0 <= inner.y0 <= inner.y1 <= outer.y1
    )


def proven_indent_rows(segment: Segment, proof: NativeIndentRows) -> list[NativeLine] | None:
    ids = segment.native_line_ids
    if (
        not ids
        or len(ids) != len(set(ids))
        or any(i not in proof.lines or proof.owners[i] != 1 for i in ids)
    ):
        return None
    rows = [proof.lines[i] for i in ids]
    for row in rows:
        ink = [g for g in row.glyphs if g.text.strip()]
        if (
            not contained(segment.box, row.box)
            or not ink
            or any(
                not g.visible
                or not g.font.strip()
                or not contained(row.box, g.box)
                or proof.glyph_owners[glyph_key(g)] != 1
                for g in ink
            )
        ):
            return None
    return rows


def native_typeface(rows: list[NativeLine]) -> tuple[str, float] | None:
    ink = [g for row in rows for g in row.glyphs if g.text.strip()]
    if not ink or any(not g.visible for g in ink):
        return None
    font = re.sub(r"^[A-Z]{6}\+", "", ink[0].font).strip()
    size = ink[0].size
    if (
        not font
        or size <= 0
        or any(
            re.sub(r"^[A-Z]{6}\+", "", g.font).strip() != font or abs(g.size - size) > 1e-6
            for g in ink
        )
    ):
        return None
    return font, size
