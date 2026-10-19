"""Keep authoritative native evidence distinct from optional untrusted index candidates."""

from typing import Any

from ..contracts.profiles import ProfileId
from ..contracts.source import Box
from .geometry import overlap
from .index_prompt import INDEX_PROMPT_VERSION
from .index_transcription_candidates import index_transcription_candidates
from .observations import PageObservation


def recognition_native_evidence(
    page: PageObservation,
    region: Box,
    profile: ProfileId,
    *,
    purpose: str,
    prompt_version: str,
    table_evidence: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    reliable = not (set(page.risks) - {"language_uncertain", "visible_annotation"}) and not any(
        g.kind == "image" and any(overlap(g.box, line.box) > 0 for line in page.lines)
        for g in page.graphics
    )
    lines = [
        line
        for line in page.lines
        if region.x0 <= line.box.x0
        and line.box.x1 <= region.x1
        and region.y0 <= line.box.y0
        and line.box.y1 <= region.y1
        and not any(
            required.kind != "inline_style" and overlap(line.box, required.box) > 0
            for required in page.required_regions
        )
    ]
    tables = [
        item
        for item in (table_evidence or [])
        if region.x0 <= item["box"]["x0"] < item["box"]["x1"] <= region.x1
        and region.y0 <= item["box"]["y0"] < item["box"]["y1"] <= region.y1
    ]
    candidates = {}
    if (
        not reliable
        and prompt_version == INDEX_PROMPT_VERSION
        and purpose == "pdf_structure_repair"
        and (region.x0, region.y0, region.x1, region.y1) == (0, 0, page.width_pt, page.height_pt)
    ):
        candidates = index_transcription_candidates(page, profile)
    return {
        **(
            {"required_regions": [r.model_dump() for r in page.required_regions]}
            if page.required_regions
            else {}
        ),
        **({"ruled_tables": tables} if tables else {}),
        "reliable": reliable and bool(lines),
        "lines": [
            {"id": line.id, "box": line.box.model_dump(), "text": line.text}
            for line in lines
            if reliable
        ],
        **candidates,
    }
