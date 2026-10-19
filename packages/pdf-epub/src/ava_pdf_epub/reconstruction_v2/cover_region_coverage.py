"""A corroborated cover can share one coverage region without changing its source boxes."""

from collections.abc import Sequence
from typing import Any

from ..contracts.common import text_digest
from ..contracts.source import Box, SourcePage
from .assembly_state import AssemblyState
from .findings import Finding
from .geometry import area, overlap, union
from .prepared_types import AnyPreparedPage
from .segments import Segment
from .source_cover import source_cover_graphic


def cover_region_coverage(
    pages: list[dict[str, Any]],
    segments: Sequence[Segment],
    prepared: Sequence[AnyPreparedPage],
    state: AssemblyState,
) -> list[dict[str, Any]]:
    from .continuation_presentation_contract import POLICY

    if (
        state.source_continuation_policy != POLICY
        or state.source_title_policy != "ava-frontmatter-title-1"
        or not state.frontmatter_cover
        or not state.frontmatter_title_compared
        or not prepared
        or not pages
        or pages[0]["number"] != 1
    ):
        return pages
    owners = {segment.id: segment for segment in segments}
    selected: set[str] = set()
    evidence: list[dict[str, Any]] = []
    for ident, digest in state.frontmatter_cover:
        owner = owners.get(ident)
        if owner is None or owner.page != 1 or owner.kind != "heading":
            raise ValueError("Cover coverage lost its compared heading owner")
        if text_digest(owner.text) != digest:
            raise ValueError("Cover coverage heading differs from its compared source")
        local = state.evidence.get(ident, [])
        if not local or any(item["page"] != 1 for item in local):
            raise ValueError("Cover coverage lost its first-page evidence")
        evidence.extend(local)
        selected.update(item["region_id"] for item in local)
    artwork = source_cover_graphic(prepared[0].observation, evidence)
    if artwork is None:
        return pages
    content = [region for region in pages[0]["regions"] if region["role"] == "content"]
    if not content or any(
        region["column"] != 0 or region["box"]["coordinate_space"] != "page_points_top_left"
        for region in content
    ):
        return pages
    if [region["box"]["y0"] for region in content] != sorted(
        region["box"]["y0"] for region in content
    ):
        return pages
    groups: list[list[dict[str, Any]]] = []
    bottom = 0.0
    for region in content:
        box = region["box"]
        if not groups or box["y0"] >= bottom:
            groups.append([])
            bottom = box["y1"]
        else:
            bottom = max(bottom, box["y1"])
        groups[-1].append(region)
    replacements: dict[str, dict[str, Any]] = {}
    mapping: dict[str, str] = {}
    for group in groups:
        if (
            len(group) < 2
            or not selected.intersection(region["id"] for region in group)
            or any(region["route"] != "ocr" for region in group)
        ):
            continue
        boxes = [Box.model_validate(region["box"]) for region in group]
        if any(overlap(box, artwork) / area(box) < 0.99 for box in boxes):
            continue
        first = group[0]
        replacements[first["id"]] = {**first, "box": union(boxes).model_dump()}
        for region in group:
            mapping[region["id"]] = first["id"]
    if not mapping:
        return pages
    regions = [
        replacements.get(region["id"], region)
        for region in pages[0]["regions"]
        if region["id"] not in mapping or mapping[region["id"]] == region["id"]
    ]
    page = {**pages[0], "regions": regions}
    # The existing guard stays authoritative; nothing is clipped or relabelled as cover.
    SourcePage.model_validate(page)
    for ident, local in state.evidence.items():
        state.evidence[ident] = [
            {**item, "region_id": mapping[item["region_id"]]}
            if item["page"] == 1 and item["region_id"] in mapping
            else item
            for item in local
        ]
    state.structure_findings.append(
        Finding(
            code="SOURCE_COVER_OVERLAP_COVERAGE_COALESCED",
            severity="information",
            page=1,
            message=(
                "Compared cover owners share coverage; source text and evidence boxes stay exact."
            ),
        )
    )
    return [page, *pages[1:]]
