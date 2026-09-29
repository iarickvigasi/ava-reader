"""Point-space geometry is finite, upright and independent of PDF object order."""

from collections.abc import Sequence

from ..contracts.source import Box


def rectangle(values: Sequence[float], width: float, height: float) -> Box:
    x0, y0, x1, y1 = values
    return Box(
        coordinate_space="page_points_top_left",
        x0=max(0, min(width, x0)),
        y0=max(0, min(height, y0)),
        x1=max(0, min(width, x1)),
        y1=max(0, min(height, y1)),
    )


def union(boxes: Sequence[Box]) -> Box:
    if not boxes:
        raise ValueError("An empty observation has no geometry")
    return Box(
        coordinate_space="page_points_top_left",
        x0=min(b.x0 for b in boxes),
        y0=min(b.y0 for b in boxes),
        x1=max(b.x1 for b in boxes),
        y1=max(b.y1 for b in boxes),
    )


def area(box: Box) -> float:
    return (box.x1 - box.x0) * (box.y1 - box.y0)


def overlap(a: Box, b: Box) -> float:
    return max(0, min(a.x1, b.x1) - max(a.x0, b.x0)) * max(0, min(a.y1, b.y1) - max(a.y0, b.y0))
