"""Keep source cover pixels independently of the OCR transcript of its printed words."""

from collections.abc import Sequence
from pathlib import Path
from typing import Any

from ..contracts.source import Box
from .assemble_figure import assemble_figure
from .assembly_state import AssemblyState
from .findings import Finding
from .geometry import area, overlap
from .prepared import PreparedPage
from .segments import Segment


def preserve_source_cover(
    prepared: Sequence[PreparedPage],
    pages: list[dict[str, Any]],
    chapters: list[dict[str, Any]],
    metadata: list[dict[str, Any]],
    scratch: Path,
    state: AssemblyState,
) -> str | None:
    if not prepared or not chapters or chapters[0]["role"] != "frontmatter":
        return None
    titles = [m for m in metadata if m["field"] == "title" and m["status"] == "accepted"]
    if len(titles) != 1:
        return None
    title_evidence = titles[0].get("evidence", [])
    if not title_evidence or any(e["page"] != 1 for e in title_evidence):
        return None
    page = prepared[0].observation
    candidates = [
        g
        for g in page.graphics
        if g.kind == "image" and area(g.box) >= page.width_pt * page.height_pt * 0.75
    ]
    if len(candidates) != 1:
        return None
    box = candidates[0].box
    if any(
        overlap(Box.model_validate(e["box"]), box) / area(Box.model_validate(e["box"])) < 0.99
        for e in title_evidence
    ):
        return None
    region_id = "page1-source-cover"
    evidence = [dict(page=1, region_id=region_id, method="render", box=box.model_dump())]
    state.evidence[region_id] = evidence
    segment = Segment(id=region_id, page=1, kind="figure", box=box, method="render")
    known = {r["id"] for r in state.resources}
    cover = assemble_figure(segment, prepared[0], scratch, state)["resource_id"]
    if cover in known:
        resource = next(r for r in state.resources if r["id"] == cover)
        resource["evidence"] = [*resource["evidence"], *evidence]
    pages[0]["regions"].append(
        dict(id=region_id, box=box.model_dump(), band=0, column=0, role="cover", route="render")
    )
    state.structure_findings.append(
        Finding(
            code="SOURCE_COVER_PIXELS_PRESERVED",
            severity="information",
            page=1,
            message=(
                "Source cover pixels preserved separately from unchanged selectable title text."
            ),
        )
    )
    return str(cover)
