"""A recognized raster must cover the complete source graphic that native output excludes."""

from ..contracts.source import Box
from .borderless_tables import borderless_tables
from .geometry import overlap, rectangle, union
from .native_graphics import native_graphics
from .native_tables import native_tables
from .observations import PageObservation
from .observe_tables import TableObservation


def graphic_recognition_regions(
    page: PageObservation, tables: list[TableObservation], regions: list[Box]
) -> list[Box]:
    if not regions:
        return regions
    full = rectangle((0, 0, page.width_pt, page.height_pt), page.width_pt, page.height_pt)
    if full in regions:
        return regions
    graphics = native_graphics(page, native_tables(page, tables or borderless_tables(page)))
    expanded = [_complete(region, [g.box for g in graphics]) for region in regions]
    # The padded/composite crop may reach native text that the original image did not.
    # Keep the existing full-page safety route instead of excluding a partial native line.
    if any(overlap(region, line.box) > 0 for region in expanded for line in page.lines):
        return [full]
    unique = {(r.x0, r.y0, r.x1, r.y1): r for r in expanded}
    return list(unique.values())


def _complete(region: Box, graphics: list[Box]) -> Box:
    previous = None
    while region != previous:
        previous = region
        # Expansion can reach a separate graphic group. Native exclusion uses overlap,
        # so every newly touched group must also be covered before dispatch.
        region = union([region, *(box for box in graphics if overlap(box, region) > 0)])
    return region
