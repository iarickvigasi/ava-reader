"""Verify declared column/band labels agree with source rectangles."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .source import SourcePage, SourceRegion


def validate_bands(page: "SourcePage") -> None:
    groups: dict[int, list[SourceRegion]] = {}
    for region in page.regions:
        if region.role == "content":
            groups.setdefault(region.band, []).append(region)
    bottom = 0.0
    for regions in groups.values():
        boxes = {
            r.id: (
                r.box.x0 / page.width_pt,
                r.box.y0 / page.height_pt,
                r.box.x1 / page.width_pt,
                r.box.y1 / page.height_pt,
            )
            if r.box.coordinate_space == "page_points_top_left"
            else (r.box.x0, r.box.y0, r.box.x1, r.box.y1)
            for r in regions
        }
        if min(boxes[r.id][1] for r in regions) < bottom:
            raise ValueError("Content bands overlap or are geometrically reversed")
        bottom = max(boxes[r.id][3] for r in regions)
        columns = {r.column for r in regions}
        if columns not in ({0}, {1, 2}):
            raise ValueError("A band is full-width or has both left and right columns")
        if columns == {1, 2}:
            left = max(boxes[r.id][2] for r in regions if r.column == 1)
            right = min(boxes[r.id][0] for r in regions if r.column == 2)
            if left > right:
                raise ValueError("Declared left/right columns overlap or are reversed")
        for column in columns:
            column_boxes = [boxes[r.id] for r in regions if r.column == column]
            if any(a[3] > b[1] for a, b in zip(column_boxes, column_boxes[1:], strict=False)):
                raise ValueError("Regions in a column must follow nonoverlapping vertical order")
