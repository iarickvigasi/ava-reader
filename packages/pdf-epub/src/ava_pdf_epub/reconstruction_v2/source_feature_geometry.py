"""Complete line groups retain the source column margin, never infer a quote from an inset."""

import math

from ..contracts.source import Box
from .geometry import rectangle
from .prepared import PreparedPage
from .segments import Segment


def same_column(target: Segment, reference: Segment) -> bool:
    a, b = target.box, reference.box
    overlap = min(a.x1, b.x1) - max(a.x0, b.x0)
    return target.page == reference.page and overlap >= min(a.x1 - a.x0, b.x1 - b.x0) * 0.8


def feature_column(target: Segment, reference: Segment, page: PreparedPage) -> Box:
    a, b, observed = target.box, reference.box, page.observation
    return rectangle(
        (min(a.x0, b.x0) - 8, min(a.y0, b.y0) - 8, max(a.x1, b.x1) + 8, max(a.y1, b.y1) + 8),
        observed.width_pt,
        observed.height_pt,
    )


def feature_crop(segment: Segment, column: Box, page: PreparedPage) -> Box:
    # Preserve complete target text and its source-column whitespace, at physical scale.
    return rectangle(
        (column.x0, segment.box.y0 - 24, column.x1, segment.box.y1 + 24),
        page.observation.width_pt,
        page.observation.height_pt,
    )


def feature_dimensions(box: Box) -> tuple[int, int]:
    return math.ceil((box.x1 - box.x0) * 2), math.ceil((box.y1 - box.y0) * 2)
