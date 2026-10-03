"""Build provisional native segments using geometry without consulting test oracles."""

from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from ..contracts.source import Box
from .borderless_tables import borderless_tables
from .classify_lines import classify_lines
from .geometry import overlap
from .native_graphics import native_graphics
from .native_literal_candidates import native_literal_candidates
from .native_paired_lines import preserve_paired_lines
from .native_roles import native_roles
from .native_spacing import native_spacing
from .native_structure_candidates import native_structure_candidates
from .native_tables import native_tables
from .observations import PageObservation
from .observe_tables import TableObservation
from .paragraphs import join_paragraphs
from .reading_order import reading_order
from .segments import Segment


def native_page(
    page: PageObservation,
    tables: list[TableObservation],
    furniture: set[str],
    excluded_regions: list[Box],
    profile_id: ProfileId = LEGACY_PROFILE,
) -> list[Segment]:
    if any(
        box.x0 <= 0 and box.y0 <= 0 and box.x1 >= page.width_pt and box.y1 >= page.height_pt
        for box in excluded_regions
    ):
        return []
    table_segments = native_tables(page, tables or borderless_tables(page))
    graphics = native_graphics(page, table_segments)
    excluded = {ident for s in [*table_segments, *graphics] for ident in s.native_line_ids}
    lines = classify_lines(page, excluded, furniture, profile_id)
    segments = [
        s
        for s in [*lines, *table_segments, *graphics]
        if not any(overlap(s.box, box) > 0 for box in excluded_regions)
    ]
    furniture_segments = [s for s in segments if s.kind == "furniture"]
    content = native_roles(
        native_structure_candidates(
            [
                p.segment
                for p in reading_order(
                    [s for s in segments if s.kind != "furniture"], page.width_pt
                )
            ]
        )
    )
    ordered = native_literal_candidates(reading_order(content, page.width_pt))
    return (
        native_spacing(
            page, [p.segment for p in preserve_paired_lines(join_paragraphs(ordered), ordered)]
        )
        + furniture_segments
    )
