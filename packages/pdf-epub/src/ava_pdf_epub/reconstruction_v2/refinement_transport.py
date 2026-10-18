"""Current continuation batches keep a finite, source-admitted transport allowance."""

import json
import struct
import tempfile
from collections.abc import Callable
from typing import Any, BinaryIO

LEGACY_REFINEMENT_BYTES = 24 * 1024 * 1024
CURRENT_REFINEMENT_BYTES = 64 * 1024 * 1024


def refinement_payload_limit(request: Any) -> int:
    from .protocol_continuation import ContinuationReconstructionInput

    return (
        CURRENT_REFINEMENT_BYTES
        if isinstance(request, ContinuationReconstructionInput)
        else LEGACY_REFINEMENT_BYTES
    )


def current_batch(payload: Any) -> bool:
    return (
        isinstance(payload, dict)
        and payload.get("schema_version") == "ava-book-refinement-batch-4"
        and payload.get("source_continuation_policy") == "ava-source-continuation-presentation-1"
    )


def _spool_json(spool: BinaryIO, packet: Any, bound: int) -> int:
    encoder = json.JSONEncoder(ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    size = 0
    for part in encoder.iterencode(packet):
        data = part.encode("utf-8")
        size += len(data)
        if size > bound:
            raise ValueError("Attempt control byte bound exceeded")
        spool.write(data)
    return size


def write_json_frame(
    stream: BinaryIO,
    packet: Any,
    bound: int,
    write: Callable[[BinaryIO, bytes], None],
    *,
    payload_bound: int | None = None,
) -> None:
    # Count the complete UTF-8 payload and envelope before emitting any prefix.
    with tempfile.TemporaryFile() as spool:
        prefix = suffix = b""
        if payload_bound is None:
            size = _spool_json(spool, packet, bound)
        else:
            if not isinstance(packet, dict) or list(packet)[-1:] != ["payload"]:
                raise ValueError("Refinement envelope requires its final payload field")
            metadata = {key: value for key, value in packet.items() if key != "payload"}
            prefix = (
                json.dumps(
                    metadata, ensure_ascii=False, separators=(",", ":"), allow_nan=False
                ).encode()[:-1]
                + (b"," if metadata else b"")
                + b'"payload":'
            )
            suffix = b"}"
            size = _spool_json(spool, packet["payload"], payload_bound) + len(prefix) + len(suffix)
            if size > bound:
                raise ValueError("Attempt control byte bound exceeded")
        spool.seek(0)
        write(stream, struct.pack(">I", size) + prefix)
        while chunk := spool.read(1024 * 1024):
            write(stream, chunk)
        if suffix:
            write(stream, suffix)
