"""Materialize source coverage and geometric order for every surviving segment."""

from collections.abc import Sequence
from typing import Any

from .assembly_state import AssemblyState
from .geometry import rectangle
from .page_checkpoints import page_geometry
from .prepared import PreparedPage
from .reading_order import reading_order
from .segments import Segment


def assemble_pages(
    prepared: Sequence[PreparedPage], segments: dict[int, list[Segment]], state: AssemblyState
) -> tuple[list[dict[str, Any]], list[Segment]]:
    pages, ordered = [], []
    branding: dict[str, list[Segment]] = {}
    protected_images = {
        segment.source_image.sha256
        for local in segments.values()
        for segment in local
        if segment.source_image is not None and not segment.source_marginal_furniture
    }
    segments = {
        number: [
            segment.model_copy(update={"source_marginal_furniture": False})
            if segment.source_image is not None and segment.source_image.sha256 in protected_images
            else segment
            for segment in local
        ]
        for number, local in segments.items()
    }
    for number in range(1, len(prepared) + 1):
        for segment in segments[number]:
            if segment.source_marginal_furniture:
                assert segment.source_image is not None
                branding.setdefault(segment.source_image.sha256, []).append(segment)
    representatives = {occurrences[-1].id: occurrences for occurrences in branding.values()}
    for number in range(len(prepared)):
        page = page_geometry(prepared, number)
        content = [
            s
            for s in segments[page.number]
            if s.kind != "furniture" and not s.source_marginal_furniture
        ]
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
        for index, segment in enumerate(
            s for s in segments[page.number] if s.kind == "furniture" or s.source_marginal_furniture
        ):
            region_id = f"page{page.number}-furniture{index}"
            if segment.source_marginal_furniture:
                state.evidence[segment.id] = [
                    dict(
                        page=page.number,
                        region_id=region_id,
                        method=segment.method,
                        box=segment.box.model_dump(),
                    )
                ]
            regions.append(
                dict(
                    id=region_id,
                    box=segment.box.model_dump(),
                    band=0,
                    column=0,
                    role="furniture",
                    route=segment.method,
                )
            )
        # Keep the representative at its final actual source page, after that
        # page's content. Never invent later-page evidence or move an earlier
        # brand past subsequent source content just to make it a book-tail image.
        for segment in segments[page.number]:
            if segment.id not in representatives:
                continue
            occurrences = representatives[segment.id]
            representative = Segment.model_validate(
                {
                    **segment.model_dump(),
                    "source_image_occurrences": [
                        e for item in occurrences for e in state.evidence[item.id]
                    ],
                }
            )
            state.segments[representative.id] = representative
            state.placements[representative.id] = (representative.page, 0, 0)
            for occurrence in occurrences[:-1]:
                state.aliases[occurrence.id] = (representative.id, 0)
            ordered.append(representative)
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
