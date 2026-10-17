"""Shared physical range/order checks do not grant layout spelling authority."""

from .layout_hyphen import LayoutHyphenLine


def validate_hyphen_order(
    left: LayoutHyphenLine, right: LayoutHyphenLine, start: int, end: int, boundary: str
) -> None:
    if (
        not left.source_start
        <= start
        < left.source_end
        <= right.source_start
        <= end
        < right.source_end
    ):
        raise ValueError("Layout-hyphen boundary is outside its ordered source lines")
    if left.line_id == right.line_id:
        raise ValueError("Layout-hyphen boundary requires distinct source lines")
    if boundary == "page":
        if right.page != left.page + 1:
            raise ValueError("Layout-hyphen page continuation is not consecutive")
    elif left.page != right.page:
        raise ValueError("Layout-hyphen line/column boundary changes source page")
    elif boundary == "line":
        if left.region_id != right.region_id or left.box.y0 >= right.box.y0:
            raise ValueError("Layout-hyphen line continuation changes reading region/order")
    elif left.region_id == right.region_id or left.box.x0 >= right.box.x0:
        raise ValueError("Layout-hyphen column continuation changes reading region/order")
