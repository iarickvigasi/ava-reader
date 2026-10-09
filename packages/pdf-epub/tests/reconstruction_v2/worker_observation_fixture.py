"""Trusted observation fixture with actual source/request bytes and no execution authority."""

import hashlib
import json
from pathlib import Path

from ava_pdf_epub.worker_observation import Observation

JOB = Path(__file__).parents[1] / "contracts" / "fixtures" / "ava-pdf-job-1.json"
UNIT = dict(schema_version="ava-worker-observation-binding-1", job_id="job-fixture",
            attempt_id="attempt-fixture", unit_id="unit-fixture")


def observation_context(root: Path, source: bytes = b"source", request=None) -> Observation:
    request = request or dict(mode="prepare", page_number=1)
    job = json.loads(JOB.read_bytes())
    job["source"].update(sha256=hashlib.sha256(source).hexdigest(), byte_length=len(source))
    (root / "job.json").write_text(json.dumps(job))
    (root / "worker-observation.json").write_text(json.dumps(UNIT))
    observation = Observation(root)
    observation.start(json.dumps(request).encode(), request, root)
    return observation
