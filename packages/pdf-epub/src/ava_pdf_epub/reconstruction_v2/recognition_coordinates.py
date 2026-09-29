"""Declared v2 render coordinates map deterministically through the trusted source crop."""

from typing import TYPE_CHECKING, Any

from ..contracts.source import Box
from .segments import Segment

if TYPE_CHECKING:
    from .recognition_segment import RecognitionSegment


def source_box(raw: dict[str, Any], crop: Box) -> dict[str, str | float]:
    if raw["coordinate_space"] != "render_normalized_1000":
        raise ValueError("Undeclared recognition coordinate space")
    width, height = crop.x1 - crop.x0, crop.y1 - crop.y0
    return {
        "coordinate_space": "page_points_top_left",
        "x0": crop.x0 + raw["x0"] / 1000 * width,
        "y0": crop.y0 + raw["y0"] / 1000 * height,
        "x1": crop.x0 + raw["x1"] / 1000 * width,
        "y1": crop.y0 + raw["y1"] / 1000 * height,
    }


def source_segment(segment: "RecognitionSegment", crop: Box) -> Segment:
    if crop.coordinate_space != "page_points_top_left":
        raise ValueError("Recognition crop must use source page points")
    raw = segment.model_dump()
    raw["box"] = source_box(raw["box"], crop)
    for row in raw["cells"]:
        for cell in row:
            cell["box"] = source_box(cell["box"], crop)
    return Segment.model_validate(raw)
