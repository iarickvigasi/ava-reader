"""Encode exact candidate artifacts under a bounded transport, not publication authority."""

import base64
import hashlib
import json

from .reconstruct import ReconstructedBook
from .report import ReconstructionReport


def candidate_packet(result: ReconstructedBook, report: ReconstructionReport) -> dict[str, object]:
    artifacts = {
        "canonical.json": result.book.model_dump_json().encode(),
        "book.epub": result.epub,
        "reconstruction-report.json": report.model_dump_json().encode(),
    }
    resources = {r.id: r.path for r in result.book.resources}
    artifacts.update({resources[ident]: data for ident, data in result.assets.items()})
    if sum(len(data) for data in artifacts.values()) > 48 * 1024 * 1024:
        raise ValueError("Candidate exceeds bounded protocol byte limit")
    return dict(
        schema_version="ava-reconstruct-result-1",
        report=report.model_dump(mode="json"),
        artifacts=[
            dict(
                path=path,
                sha256=hashlib.sha256(data).hexdigest(),
                byte_length=len(data),
                base64=base64.b64encode(data).decode(),
            )
            for path, data in artifacts.items()
        ],
    )


def encode_packet(packet: dict[str, object], limit: int) -> bytes:
    data = json.dumps(packet, ensure_ascii=False, separators=(",", ":")).encode()
    if len(data) > limit:
        raise ValueError("Protocol output byte bound exceeded")
    return data
