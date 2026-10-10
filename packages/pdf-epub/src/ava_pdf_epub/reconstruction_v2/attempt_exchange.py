"""Finite attempt controls; provider objects retain their existing versioned contracts."""

import json
import struct
from typing import Any, BinaryIO, Literal

from pydantic import Field

from ..contracts.common import Digest, Record
from ..contracts.profiles import ProfileId

PAGE_CONTROL_BYTES = 8 * 1024 * 1024 + 1024
REFINEMENT_CONTROL_BYTES = 24 * 1024 * 1024 + 1024
TERMINAL_CONTROL_BYTES = 256 * 1024 + 1024
REPLY_BYTES = 64 * 1024 * 1024 + 1024
TOTAL_REPLY_BYTES = 64 * 1024 * 1024 + 25533 * 1024
ExchangeKind = Literal[
    "page", "recognition", "refinement_batch", "refinement", "artifacts", "refusal"
]


def _unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate attempt JSON key")
        result[key] = value
    return result


def _constant(_: str) -> None:
    raise ValueError("Nonfinite attempt JSON value")


def strict_json(data: bytes) -> Any:
    return json.loads(data.decode("utf-8"), object_pairs_hook=_unique, parse_constant=_constant)


def json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()


class Exchange(Record):
    schema_version: Literal["ava-reconstruction-exchange-1"]
    sequence: int = Field(ge=1, le=25534)
    source_sha256: Digest
    profile_id: ProfileId
    kind: ExchangeKind
    payload: Any


def _exact(stream: BinaryIO, size: int) -> bytes:
    result = bytearray()
    while len(result) < size:
        data = stream.read(size - len(result))
        if not data:
            raise ValueError("Truncated attempt reply or EOF")
        result.extend(data)
    return bytes(result)


def _read_exchange(stream: BinaryIO, bound: int) -> tuple[Exchange, int]:
    size = struct.unpack(">I", _exact(stream, 4))[0]
    if not 0 < size <= bound:
        raise ValueError("Attempt reply byte bound exceeded")
    return Exchange.model_validate(strict_json(_exact(stream, size))), size + 4


def read_exchange(stream: BinaryIO) -> Exchange:
    return _read_exchange(stream, REPLY_BYTES)[0]


def write_bytes(stream: BinaryIO, data: bytes) -> None:
    offset = 0
    while offset < len(data):
        written = stream.write(data[offset : offset + 1024 * 1024])
        if written is None or written <= 0:
            raise ValueError("Attempt output ended before complete bytes")
        offset += written
    stream.flush()


class ExchangeWriter:
    def __init__(self, stream: BinaryIO, source_sha256: str, profile_id: ProfileId):
        self.stream = stream
        self.source_sha256, self.profile_id = source_sha256, profile_id
        self.sequence = 0
        self.terminal = False
        self._reply_bytes = 0

    def emit(self, kind: ExchangeKind, payload: Any) -> Exchange:
        if self.terminal:
            raise ValueError("Attempt control follows terminal marker")
        packet = Exchange(
            schema_version="ava-reconstruction-exchange-1",
            sequence=self.sequence + 1,
            source_sha256=self.source_sha256,
            profile_id=self.profile_id,
            kind=kind,
            payload=payload,
        )
        data = json_bytes(packet.model_dump(mode="json"))
        bound = (
            PAGE_CONTROL_BYTES
            if kind == "page"
            else REFINEMENT_CONTROL_BYTES
            if kind == "refinement_batch"
            else 1024
            if kind in {"recognition", "refinement"}
            else TERMINAL_CONTROL_BYTES
        )
        if len(data) > bound:
            raise ValueError("Attempt control byte bound exceeded")
        write_bytes(self.stream, struct.pack(">I", len(data)) + data)
        self.sequence = packet.sequence
        self.terminal = kind in {"artifacts", "refusal"}
        return packet

    def reply(self, stream: BinaryIO, request: Exchange) -> list[Any]:
        reply, size = _read_exchange(
            stream, min(REPLY_BYTES, TOTAL_REPLY_BYTES - self._reply_bytes - 4)
        )
        self._reply_bytes += size
        if (
            reply.sequence != request.sequence
            or reply.source_sha256 != self.source_sha256
            or reply.profile_id != self.profile_id
            or reply.kind != request.kind
            or request.kind not in {"page", "recognition", "refinement_batch", "refinement"}
            or not isinstance(reply.payload, list)
        ):
            raise ValueError("Attempt reply belongs to another exchange")
        return reply.payload
