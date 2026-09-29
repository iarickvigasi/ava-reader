"""Validate geometric evidence and account for every declared content region."""

from typing import TYPE_CHECKING

from .blocks import BlockBase, NoteBlock
from .source import Box

if TYPE_CHECKING:
    from .book import CanonicalBookV2


def normalized(box: Box, width: float, height: float) -> tuple[float, float, float, float]:
    if box.coordinate_space == "normalized_top_left":
        return box.x0, box.y0, box.x1, box.y1
    return box.x0 / width, box.y0 / height, box.x1 / width, box.y1 / height


def validate_source(book: "CanonicalBookV2", nodes: dict[str, BlockBase]) -> None:
    if [p.number for p in book.pages] != list(range(1, book.source.page_count + 1)):
        raise ValueError("Source pages must be contiguous and complete")
    regions = {(p.number, r.id): (p, r) for p in book.pages for r in p.regions}
    if len(regions) > 20000:
        raise ValueError("Aggregate region bound exceeded")
    evidence = [e for n in nodes.values() for e in n.evidence]
    evidence += [e for r in book.resources for e in r.evidence]
    evidence += [e for claim in book.metadata for e in claim.evidence]
    if len(evidence) > 100000:
        raise ValueError("Aggregate evidence bound exceeded")
    covered = {(e.page, e.region_id) for n in nodes.values() for e in n.evidence}
    if book.cover_resource_id is not None:
        covered.update(
            (e.page, e.region_id)
            for resource in book.resources
            if resource.id == book.cover_resource_id
            for e in resource.evidence
        )
    for e in evidence:
        if (e.page, e.region_id) not in regions:
            raise ValueError("Evidence references unknown source region")
        p, r = regions[(e.page, e.region_id)]
        inner = normalized(e.box, p.width_pt, p.height_pt)
        outer = normalized(r.box, p.width_pt, p.height_pt)
        if not (
            outer[0] <= inner[0] < inner[2] <= outer[2]
            and outer[1] <= inner[1] < inner[3] <= outer[3]
        ):
            raise ValueError("Evidence box outside source region")
    if any(r.role == "content" and key not in covered for key, (_, r) in regions.items()):
        raise ValueError("Required source region has no content evidence")

    ranks = {key: i for i, key in enumerate(regions)}
    previous = -1
    for block in book.blocks:
        order = [ranks[(e.page, e.region_id)] for e in block.evidence]
        if order != sorted(order):
            raise ValueError("Block evidence reverses declared source reading order")
        if not isinstance(block, NoteBlock):
            if order[0] < previous:
                raise ValueError("Canonical block order reverses source region order")
            previous = order[-1]
