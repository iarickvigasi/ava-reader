"""Consolidate deterministic source reading bands without pre-deciding paragraph breaks."""

from ..contracts.source import SourcePage
from .geometry import union
from .native_structure_fields import NativeStructureRegion
from .observations import PageObservation
from .reading_order import Placement, reading_order
from .segments import Segment


def native_structure_regions(
    page: PageObservation, preserved: list[Segment], furniture: set[str]
) -> list[NativeStructureRegion]:
    excluded = {ident for segment in preserved for ident in segment.native_line_ids}
    lines = [
        Segment(
            id=line.id,
            page=page.number,
            box=line.box,
            text=line.text,
            style=line.style,
            native_line_ids=[line.id],
            method="native",
            kind="paragraph",
        )
        for line in page.lines
        if line.id not in excluded
    ]
    margins = [s for s in lines if s.id in furniture]
    margins.extend(s for s in preserved if s.source_marginal_furniture)
    content = [s for s in lines if s.id not in furniture]
    content.extend(s for s in preserved if not s.source_marginal_furniture)
    if not content:
        raise ValueError("Native structure furniture-only page keeps its existing route")
    artifacts = {segment.id for segment in preserved}
    grouped: list[list[Placement]] = []
    for placement in reading_order(content, page.width_pt):
        previous = grouped[-1][-1] if grouped else None
        compatible = (
            previous is not None
            and placement.segment.id not in artifacts
            and previous.segment.id not in artifacts
            and placement.column == previous.column
            and (placement.column == 0 or placement.band == previous.band)
            and previous.segment.box.y1 <= placement.segment.box.y0
        )
        if compatible:
            grouped[-1].append(placement)
        else:
            grouped.append([placement])
    regions: list[NativeStructureRegion] = []
    bands: dict[int, int] = {}
    for group in grouped:
        original = group[0].band
        if original not in bands:
            bands[original] = len(set(bands.values()))
        band = bands[original]
        for placement in group:
            bands[placement.band] = band
        segments = [placement.segment for placement in group]
        artifact = segments[0].id if segments[0].id in artifacts else None
        regions.append(
            _region(page, len(regions), segments, band, group[0].column, "content", artifact)
        )
    for margin in sorted(margins, key=lambda s: (s.box.y0, s.box.x0)):
        artifact = margin.id if margin.id in artifacts else None
        regions.append(_region(page, len(regions), [margin], 0, 0, "furniture", artifact))
    SourcePage(
        number=page.number,
        width_pt=page.width_pt,
        height_pt=page.height_pt,
        original_rotation=page.rotation,
        regions=[r.source for r in regions],
    )
    return regions


def _region(
    page: PageObservation,
    index: int,
    segments: list[Segment],
    band: int,
    column: int,
    role: str,
    artifact: str | None,
) -> NativeStructureRegion:
    return NativeStructureRegion.model_validate(
        dict(
            source=dict(
                id=f"p{page.number}-native-region{index}",
                box=union([s.box for s in segments]).model_dump(),
                band=band,
                column=column,
                role=role,
                route=segments[0].method if artifact else "native",
            ),
            line_ids=[ident for segment in segments for ident in segment.native_line_ids],
            artifact_id=artifact,
        )
    )
