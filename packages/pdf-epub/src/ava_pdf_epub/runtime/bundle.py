"""Only declared, verified bytes leave scratch; no output directory is mounted to the host."""

import base64
import json
from pathlib import Path

from ..contracts.artifact_bytes import verify_artifact_bytes
from ..contracts.private_files import snapshot
from ..contracts.results import WorkerResultV1

MAX_OUTPUT_BYTES = 32 * 1024 * 1024
MAX_ARTIFACT_BYTES = 16 * 1024 * 1024


def encode_bundle(result: WorkerResultV1, root: Path) -> bytes:
    outcome = result.outcome
    descriptors = (
        [outcome.canonical_book, outcome.epub, outcome.validation_report, *outcome.resources]
        if outcome.status == "candidate"
        else [outcome.diagnostic]
    )
    if sum(item.byte_length for item in descriptors) > MAX_ARTIFACT_BYTES:
        raise ValueError("RESULT_SIZE_LIMIT")
    artifacts = []
    for item in descriptors:
        verify_artifact_bytes(root, item)
        data = snapshot(root, item.path, item.byte_length)
        artifacts.append({"id": item.id, "base64": base64.b64encode(data).decode("ascii")})
    output = json.dumps(
        {"version": "ava-runtime-bundle-1", "result": result.model_dump(), "artifacts": artifacts},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode()
    if len(output) > MAX_OUTPUT_BYTES:
        raise ValueError("RESULT_SIZE_LIMIT")
    return output
