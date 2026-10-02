"""Measure contact-sheet geometry before image allocation; split decisions instead of shrinking."""

import math
from collections.abc import Mapping
from typing import Literal

from ..contracts.source import Box
from .geometry import rectangle
from .prepared import PreparedPage
from .segments import Segment

SCALE = 2
SLOT_WIDTH = 1024
LABEL_HEIGHT = 32


def crop_geometry(
    segment: Segment, page: PreparedPage, part: Literal["head", "tail"] = "head"
) -> tuple[Box, int, int]:
    observed, box = page.observation, segment.box
    top, bottom = box.y0, box.y1
    if segment.kind == "paragraph":
        if part == "tail":
            top = max(box.y0, box.y1 - 100)
        else:
            bottom = min(box.y1, box.y0 + 100)
    if segment.structure_candidate:
        top = max(0, top - 24)
        bottom = min(observed.height_pt, bottom + 36)
    region = rectangle(
        (box.x0 - 4, top - 4, box.x1 + 4, bottom + 4), observed.width_pt, observed.height_pt
    )
    return (
        region,
        math.ceil((region.x1 - region.x0) * SCALE),
        math.ceil((region.y1 - region.y0) * SCALE),
    )


def sheet_row_heights(heights: list[int]) -> list[int]:
    return [max(heights[i : i + 2]) + LABEL_HEIGHT + 16 for i in range(0, len(heights), 2)]


def crop_parts(
    ids: list[str], segments: dict[str, Segment], tail_ids: set[str]
) -> list[tuple[str, Literal["head", "tail"]]]:
    parts: list[tuple[str, Literal["head", "tail"]]] = []
    for ident in ids:
        parts.append((ident, "head"))
        box = segments[ident].box
        if ident in tail_ids and box.y1 - box.y0 > 100:
            parts.append((ident, "tail"))
    return parts


def sheet_fits(
    ids: list[str],
    segments: dict[str, Segment],
    pages: Mapping[int, PreparedPage],
    tail_ids: set[str] | None = None,
) -> bool:
    dimensions = [
        crop_geometry(segments[key], pages[segments[key].page], part)[1:]
        for key, part in crop_parts(ids, segments, tail_ids or set())
    ]
    return (
        bool(dimensions)
        and len(dimensions) <= 48
        and all(width <= SLOT_WIDTH and height <= 1000 for width, height in dimensions)
        and sum(sheet_row_heights([height for _, height in dimensions])) <= 2048
    )
