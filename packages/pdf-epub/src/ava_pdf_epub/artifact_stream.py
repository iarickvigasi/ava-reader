"""Shared bounded NDJSON transfer for fixed, authenticated host-selected protocols."""

import base64
import hashlib
import json
from collections.abc import Iterator
from typing import Any


def artifact_records(
    artifacts: dict[str, bytes], report: dict[str, Any], schema_version: str
) -> Iterator[bytes]:
    if (
        any(not data or len(data) > 256 * 1024 * 1024 for data in artifacts.values())
        or sum(len(data) for data in artifacts.values()) > 512 * 1024 * 1024
    ):
        raise ValueError("Streamed artifact byte bounds exceeded")
    manifest = [
        dict(path=path, sha256=hashlib.sha256(data).hexdigest(), byte_length=len(data))
        for path, data in artifacts.items()
    ]
    yield _line(dict(schema_version=schema_version, report=report, artifacts=manifest))
    for path, data in artifacts.items():
        for offset in range(0, len(data), 256 * 1024):
            yield _line(
                dict(
                    path=path,
                    offset=offset,
                    base64=base64.b64encode(data[offset : offset + 256 * 1024]).decode(),
                )
            )
    yield _line(dict(complete=True))


def _line(value: dict[str, object]) -> bytes:
    data = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode() + b"\n"
    if len(data) > 400 * 1024:
        raise ValueError("Stream record byte bound exceeded")
    return data
