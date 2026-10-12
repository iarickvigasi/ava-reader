"""Prepare only a missing-title comparison; no text or semantic role is changed here."""

from collections.abc import Mapping
from pathlib import Path

from ..contracts.common import text_digest
from .prepared import PreparedPage
from .printed_title_candidates import printed_title_candidate
from .printed_title_contract import PrintedTitleNode, PrintedTitleTask
from .printed_title_geometry import title_geometry
from .printed_title_sheet import printed_title_sheet
from .refinement_identity import refinement_identifier
from .segments import Segment


def printed_title_task(
    segments: list[Segment],
    pages: Mapping[int, PreparedPage],
    scratch: Path,
    source_sha: str,
    observation_sha: str,
) -> PrintedTitleTask | None:
    candidate = printed_title_candidate(segments)
    if candidate is None or (candidate.method != "native" and candidate.method != "ocr"):
        return None
    page = pages[1].observation
    node = PrintedTitleNode(
        id=candidate.id,
        page=1,
        text=candidate.text,
        text_sha256=text_digest(candidate.text),
        method=candidate.method,
        box=candidate.box,
        page_width_pt=page.width_pt,
        page_height_pt=page.height_pt,
        render_sha256=page.render_sha256,
    )
    _, width, height = title_geometry(node)
    if max(width, height) > 2048:
        return None
    crops, image = printed_title_sheet(node, pages[1], scratch)
    raw = dict(
        schema_version="ava-printed-title-task-1",
        source_sha256=source_sha,
        observation_sha256=observation_sha,
        profile_id=pages[1].profile_id,
        prompt_version="ava-printed-title-1",
        response_schema_version="ava-printed-title-response-1",
        node=node.model_dump(mode="json"),
        pixels_per_point=2,
        crops=[crop.model_dump(mode="json") for crop in crops],
        image=image.model_dump(mode="json"),
    )
    raw["task_id"] = refinement_identifier(raw)
    return PrintedTitleTask.model_validate(raw)
