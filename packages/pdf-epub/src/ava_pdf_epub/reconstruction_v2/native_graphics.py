"""Crop complete connected source graphics; never use a screenshot to replace essential prose."""

from typing import Literal

from ..contracts.source import Box
from .geometry import overlap, rectangle, union
from .native_aside_fonts import native_aside_fonts
from .observations import Graphic, PageObservation
from .segments import Segment


def native_graphics(page: PageObservation, tables: list[Segment]) -> list[Segment]:
    graphics = [g for g in page.graphics if not any(overlap(g.box, t.box) > 0 for t in tables)]
    groups: list[list[Graphic]] = []
    for graphic in graphics:
        nearby = [group for group in groups if _near(union([g.box for g in group]), graphic.box)]
        if nearby:
            joined = [graphic]
            for group in nearby:
                groups.remove(group)
                joined.extend(group)
            groups.append(joined)
        else:
            groups.append([graphic])
    segments = []
    for index, group in enumerate(groups):
        box = union([g.box for g in group])
        if box.x1 - box.x0 < 1 or box.y1 - box.y0 < 1:
            continue
        enclosed = [line for line in page.lines if overlap(line.box, box) > 0]
        raster = any(g.kind == "image" for g in group)
        prose = (
            not raster
            and len(group) <= 2
            and enclosed
            and all(len(line.text) > 50 for line in enclosed)
        )
        kind: Literal["aside", "figure"] = "aside" if prose else "figure"
        text = "\n".join(line.text for line in enclosed)
        ident = f"p{page.number}-graphic{index}"
        style, spans = (
            native_aside_fonts(
                page, enclosed, box, {ident for t in tables for ident in t.native_line_ids}, ident
            )
            if prose
            else (None, [])
        )
        if not prose:
            box = _padded(box, page, {line.id for line in enclosed})
        segments.append(
            Segment(
                id=ident,
                page=page.number,
                box=box,
                kind=kind,
                text=text if prose else "",
                style=style,
                spans=spans,
                alt=text if not prose else "",
                native_line_ids=[line.id for line in enclosed],
                method="native" if prose else "render",
            )
        )
    return segments


def _near(a: Box, b: Box) -> bool:
    return a.x0 <= b.x1 + 32 and b.x0 <= a.x1 + 32 and a.y0 <= b.y1 + 32 and b.y0 <= a.y1 + 32


def _padded(box: Box, page: PageObservation, enclosed: set[str]) -> Box:
    x0, y0, x1, y1 = (
        max(0, box.x0 - 6),
        max(0, box.y0 - 6),
        min(page.width_pt, box.x1 + 6),
        min(page.height_pt, box.y1 + 6),
    )
    for line in page.lines:
        if line.id in enclosed:
            continue
        other = line.box
        if other.x0 < box.x1 and other.x1 > box.x0:
            if other.y0 >= box.y1:
                y1 = min(y1, max(box.y1, other.y0 - 0.5))
            if other.y1 <= box.y0:
                y0 = max(y0, min(box.y0, other.y1 + 0.5))
    return rectangle((x0, y0, x1, y1), page.width_pt, page.height_pt)
