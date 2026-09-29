"""Bounded NDJSON artifact transfer; the host verifies contiguous bytes against the header."""

import base64
import hashlib
import json
from collections.abc import Iterator

from .reconstruct import ReconstructedBook
from .report import ReconstructionReport

CHUNK_BYTES = 256 * 1024
MAX_ARTIFACT = 256 * 1024 * 1024
MAX_TOTAL = 512 * 1024 * 1024


def stream_artifacts(result: ReconstructedBook, report: ReconstructionReport) -> Iterator[bytes]:
    artifacts = {
        "canonical.json": result.book.model_dump_json().encode(),
        "book.epub": result.epub,
        "reconstruction-report.json": report.model_dump_json().encode(),
    }
    resources = {resource.id: resource.path for resource in result.book.resources}
    artifacts.update({resources[ident]: data for ident, data in result.assets.items()})
    if (
        any(len(data) > MAX_ARTIFACT for data in artifacts.values())
        or sum(len(data) for data in artifacts.values()) > MAX_TOTAL
    ):
        raise ValueError("Candidate exceeds streamed artifact byte bounds")
    manifest = [
        dict(path=path, sha256=hashlib.sha256(data).hexdigest(), byte_length=len(data))
        for path, data in artifacts.items()
    ]
    yield _line(
        dict(
            schema_version="ava-reconstruct-stream-1",
            report=report.model_dump(mode="json"),
            artifacts=manifest,
        )
    )
    for path, data in artifacts.items():
        for offset in range(0, len(data), CHUNK_BYTES):
            yield _line(
                dict(
                    path=path,
                    offset=offset,
                    base64=base64.b64encode(data[offset : offset + CHUNK_BYTES]).decode(),
                )
            )
    yield _line(dict(complete=True))


def _line(value: dict[str, object]) -> bytes:
    data = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode() + b"\n"
    if len(data) > 400 * 1024:
        raise ValueError("Stream record byte bound exceeded")
    return data
