"""Overlapping text owners can share coverage without sharing semantic identity."""

from typing import Any

from ..contracts.source import Box, SourcePage
from .assembly_state import AssemblyState
from .findings import Finding
from .geometry import union

_NON_TEXT = {"figure", "table", "separator", "furniture", "unsupported"}


def source_region_coverage(
    pages: list[dict[str, Any]], state: AssemblyState
) -> list[dict[str, Any]]:
    from .continuation_presentation_contract import POLICY

    if state.source_continuation_policy != POLICY:
        return pages
    result = []
    for page in pages:
        # The first page has a separate, image-corroborated cover authority.
        if page["number"] == 1:
            result.append(page)
            continue
        rebuilt, mapping = _page_coverage(page, state)
        if not mapping:
            result.append(page)
            continue
        # Keep the existing page/gutter/band guards authoritative and commit atomically.
        SourcePage.model_validate(rebuilt)
        for ident, local in state.evidence.items():
            state.evidence[ident] = [
                {**item, "region_id": mapping[item["region_id"]]}
                if item["page"] == page["number"] and item["region_id"] in mapping
                else item
                for item in local
            ]
        state.structure_findings.append(
            Finding(
                code="SOURCE_TEXT_OVERLAP_COVERAGE_COALESCED",
                severity="information",
                page=page["number"],
                message=(
                    "Overlapping text owners share coverage; their text, source boxes and "
                    "semantic positions stay exact."
                ),
            )
        )
        result.append(rebuilt)
    return result


def _page_coverage(
    page: dict[str, Any], state: AssemblyState
) -> tuple[dict[str, Any], dict[str, str]]:
    content = [r for r in page["regions"] if r["role"] == "content"]
    order = [(r["band"], r["column"]) for r in content]
    if order != sorted(order):
        return page, {}
    groups: list[list[dict[str, Any]]] = []
    bottom = 0.0
    for region in content:
        box = region["box"]
        previous = groups[-1][-1] if groups else None
        same_lane = previous is not None and (
            region["column"] == previous["column"]
            and region["route"] == previous["route"]
            and (region["column"] == 0 or region["band"] == previous["band"])
        )
        if (
            not same_lane
            or box["y0"] >= bottom
            or (previous is not None and box["y0"] < previous["box"]["y0"])
        ):
            groups.append([])
            bottom = box["y1"]
        else:
            bottom = max(bottom, box["y1"])
        groups[-1].append(region)
    replacements: dict[str, dict[str, Any]] = {}
    mapping: dict[str, str] = {}
    for group in groups:
        if len(group) < 2 or not all(_qualified(page["number"], r, state) for r in group):
            continue
        first = group[0]
        replacements[first["id"]] = {
            **first,
            "box": union([Box.model_validate(r["box"]) for r in group]).model_dump(),
        }
        mapping.update({r["id"]: first["id"] for r in group})
    return {
        **page,
        "regions": [
            replacements.get(r["id"], r)
            for r in page["regions"]
            if r["id"] not in mapping or mapping[r["id"]] == r["id"]
        ],
    }, mapping


def _qualified(number: int, region: dict[str, Any], state: AssemblyState) -> bool:
    if region["route"] not in {"native", "ocr"}:
        return False
    outer = Box.model_validate(region["box"])
    if outer.coordinate_space != "page_points_top_left":
        return False
    witnessed = False
    for ident, local in state.evidence.items():
        for item in local:
            if item["page"] != number or item["region_id"] != region["id"]:
                continue
            owner = state.segments.get(ident)
            if (
                owner is None
                or owner.kind in _NON_TEXT
                or owner.page != number
                or owner.method != region["route"]
                or item["method"] != region["route"]
            ):
                return False
            inner = Box.model_validate(item["box"])
            if (
                inner.coordinate_space != outer.coordinate_space
                or not outer.x0 <= inner.x0 < inner.x1 <= outer.x1
                or not outer.y0 <= inner.y0 < inner.y1 <= outer.y1
            ):
                return False
            witnessed = witnessed or inner == outer
    return witnessed
