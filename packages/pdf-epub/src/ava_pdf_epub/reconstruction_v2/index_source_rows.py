"""Account for all body ink in two source-witnessed columns, including fused lines."""

from statistics import median

from ..contracts.profiles import ProfileId
from .furniture import furniture_ids
from .index_layout import TITLE, index_rows
from .index_projection_types import IndexSourceRow
from .index_source_row import index_source_row
from .native_line_visibility import complete_visible_line
from .observations import PageObservation


def index_source_rows(page: PageObservation, profile: ProfileId) -> list[IndexSourceRow] | None:
    headers = [
        line
        for line in page.lines
        if line.box.y0 < page.height_pt / 4 and TITLE.fullmatch(" ".join(line.text.split()))
    ]
    if len(headers) != 1 or not index_rows(page):
        return None
    header = headers[0]
    excluded = furniture_ids([page], profile)
    if len({line.id for line in page.lines}) != len(page.lines):
        return None
    rows, count = [], 0
    for line in page.lines:
        if line.id in excluded:
            continue
        if not complete_visible_line(line):
            return None
        if line.id == header.id:
            continue
        if line.box.y0 <= header.box.y1:
            return None  # Unaccounted full-width bands cannot disappear.
        values = [(i, g) for i, g in enumerate(line.glyphs) if g.text.strip()]
        if not values or any(g.box.x0 <= page.width_pt / 2 <= g.box.x1 for _, g in values):
            return None
        count += len(values)
        if count > 40000:
            return None
        for column in (0, 1):
            selected = [
                (i, g)
                for i, g in values
                if (g.box.x1 < page.width_pt / 2 if column == 0 else g.box.x0 > page.width_pt / 2)
            ]
            if selected:
                row = index_source_row(page, line, selected, column)
                if row is None:
                    return None
                rows.append(row)
    if not rows or len(rows) > 1000:
        return None
    left, right = [r for r in rows if r.column == 0], [r for r in rows if r.column == 1]
    if not left or not right:
        return None
    size = median(g.size for row in rows for _, g in row.values)
    if min(r.box.x0 for r in right) - max(r.box.x1 for r in left) < size:
        return None  # Positive row pairs plus an empty whole-body corridor qualify the split.
    rows.sort(key=lambda r: (r.column, r.box.y0, r.box.x0))
    if any(
        a.column == b.column and b.box.y0 < a.box.y1 for a, b in zip(rows, rows[1:], strict=False)
    ):
        return None
    return rows
