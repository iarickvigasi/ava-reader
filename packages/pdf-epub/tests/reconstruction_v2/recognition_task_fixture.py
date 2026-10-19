"""Small authored recognition request; pixel identity is real, page geometry is synthetic."""

import base64
import hashlib
import io
import json

from PIL import Image

from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionTask
from ava_pdf_epub.reconstruction_v2.task_identity import task_identifier


def task_fixture(crop=(100, 200, 300, 600)):
    stream = io.BytesIO()
    Image.new("RGB", (4, 8), "white").save(stream, format="PNG")
    image = stream.getvalue()
    evidence = json.dumps({"reliable": False, "lines": []}, separators=(",", ":"))
    raw = dict(
        schema_version="ava-recognition-task-1",
        task_id="pending",
        purpose="pdf_region_recognition",
        source_sha256="a" * 64,
        profile_id="ava-pdf-prose-en-v2",
        page_number=1,
        page_width_pt=504.0,
        page_height_pt=720.0,
        region_box=dict(
            coordinate_space="page_points_top_left",
            x0=float(crop[0]),
            y0=float(crop[1]),
            x1=float(crop[2]),
            y1=float(crop[3]),
        ),
        image=dict(
            media_type="image/png",
            sha256=hashlib.sha256(image).hexdigest(),
            byte_length=len(image),
            width=4,
            height=8,
            base64=base64.b64encode(image).decode(),
        ),
        native_evidence=evidence,
        native_evidence_sha256=hashlib.sha256(evidence.encode()).hexdigest(),
        prompt_version="ava-prose-region-2",
        response_schema_version="ava-recognition-response-2",
    )
    raw["task_id"] = task_identifier(raw)
    return RecognitionTask.model_validate(raw)
