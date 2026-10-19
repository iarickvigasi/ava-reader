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
from .observations import PageObservation
from .recognition_contract import RecognitionTask
from .recognition_native_evidence import recognition_native_evidence
from .recognition_versions import RecognitionPromptVersion
from .task_identity import task_identifier


def make_task(
    page: PageObservation,
    source_sha: str,
    region: Box,
    scratch: Path,
    purpose: Literal["pdf_region_recognition", "pdf_structure_repair"] = "pdf_region_recognition",
    profile_id: ProfileId = LEGACY_PROFILE,
    prompt_version: RecognitionPromptVersion = "ava-prose-region-15",
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
    evidence = json.dumps(
        recognition_native_evidence(
            page,
            region,
            profile_id,
            purpose=purpose,
            prompt_version=prompt_version,
            table_evidence=table_evidence,
        ),
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
