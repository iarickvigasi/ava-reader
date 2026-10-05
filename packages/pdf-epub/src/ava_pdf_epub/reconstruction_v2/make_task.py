"""One deterministic bounded visual task per unqualified region, without execution authority."""

import base64
import hashlib
import io
import json
from pathlib import Path
from typing import Any, Literal

from PIL import Image

from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from ..contracts.source import Box
from .geometry import overlap
from .observations import PageObservation
from .recognition_contract import RecognitionTask
from .recognition_versions import RecognitionPromptVersion
from .task_identity import task_identifier


def make_task(
    page: PageObservation,
    source_sha: str,
    region: Box,
    scratch: Path,
    purpose: Literal["pdf_region_recognition", "pdf_structure_repair"] = "pdf_region_recognition",
    profile_id: ProfileId = LEGACY_PROFILE,
    prompt_version: RecognitionPromptVersion = "ava-prose-region-13",
    table_evidence: list[dict[str, Any]] | None = None,
) -> RecognitionTask:
    with Image.open(scratch / page.render_path) as rendered:
        sx, sy = rendered.width / page.width_pt, rendered.height / page.height_pt
        crop = rendered.crop(
            (
                int(region.x0 * sx),
                int(region.y0 * sy),
                min(rendered.width, int(region.x1 * sx) + 1),
                min(rendered.height, int(region.y1 * sy) + 1),
            )
        )
        buffer = io.BytesIO()
        crop.save(buffer, format="PNG")
    data = buffer.getvalue()
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
    table_evidence = [
        item
        for item in (table_evidence or [])
        if region.x0 <= item["box"]["x0"] < item["box"]["x1"] <= region.x1
        and region.y0 <= item["box"]["y0"] < item["box"]["y1"] <= region.y1
    ]
    evidence = json.dumps(
        {
            **(
                {"required_regions": [r.model_dump() for r in page.required_regions]}
                if page.required_regions
                else {}
            ),
            **({"ruled_tables": table_evidence} if table_evidence else {}),
            "reliable": reliable and bool(lines),
            "lines": [
                {"id": line.id, "box": line.box.model_dump(), "text": line.text}
                for line in lines
                if reliable
            ],
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    values = dict(
        schema_version="ava-recognition-task-1",
        task_id="pending",
        purpose=purpose,
        source_sha256=source_sha,
        profile_id=profile_id,
        page_number=page.number,
        page_width_pt=page.width_pt,
        page_height_pt=page.height_pt,
        region_box=region.model_dump(),
        image=dict(
            media_type="image/png",
            sha256=hashlib.sha256(data).hexdigest(),
            byte_length=len(data),
            width=crop.width,
            height=crop.height,
            base64=base64.b64encode(data).decode(),
        ),
        native_evidence=evidence,
        native_evidence_sha256=hashlib.sha256(evidence.encode()).hexdigest(),
        prompt_version=prompt_version,
        response_schema_version="ava-recognition-response-2",
    )
    values["task_id"] = task_identifier(values)
    return RecognitionTask.model_validate(values)
