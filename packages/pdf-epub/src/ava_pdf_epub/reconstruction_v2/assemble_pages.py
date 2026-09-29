"""Materialize source coverage and geometric order for every surviving segment."""

from typing import Any

from .assembly_state import AssemblyState
from .geometry import rectangle
from .prepared import PreparedPage
from .reading_order import reading_order
from .segments import Segment


def assemble_pages(
    prepared: list[PreparedPage], segments: dict[int, list[Segment]], state: AssemblyState
) -> tuple[list[dict[str, Any]], list[Segment]]:
    pages, ordered = [], []
    for checkpoint in prepared:
        page = checkpoint.observation
        content = [s for s in segments[page.number] if s.kind != "furniture"]
        placements = reading_order(content, page.width_pt)
        regions = []
        for index, item in enumerate(placements):
            segment = item.segment
            state.placements[segment.id] = (page.number, item.band, item.column)
            region_id = f"page{page.number}-region{index}"
            region = dict(
                id=region_id,
                box=segment.box.model_dump(),
                band=item.band,
                column=item.column,
                role="content",
                route=segment.method,
            )
            regions.append(region)
            state.evidence[segment.id] = [
                dict(
                    page=page.number,
                    region_id=region_id,
                    method=segment.method,
                    box=segment.box.model_dump(),
                )
            ]
            state.segments[segment.id] = segment
            ordered.append(segment)
        for index, segment in enumerate(s for s in segments[page.number] if s.kind == "furniture"):
            regions.append(
                dict(
                    id=f"page{page.number}-furniture{index}",
                    box=segment.box.model_dump(),
                    band=0,
                    column=0,
                    role="furniture",
                    route=segment.method,
                )
            )
        if not regions:
            regions.append(
                dict(
                    id=f"page{page.number}-blank",
                    band=0,
                    column=0,
                    role="blank",
                    route="blank",
                    box=rectangle(
                        (0, 0, page.width_pt, page.height_pt), page.width_pt, page.height_pt
                    ).model_dump(),
                )
            )
        pages.append(
            dict(
                number=page.number,
                width_pt=page.width_pt,
                height_pt=page.height_pt,
                original_rotation=page.rotation,
                regions=regions,
            )
        )
    return pages, ordered
