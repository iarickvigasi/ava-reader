"""Finite attempt controls; provider objects retain their existing versioned contracts."""

import json
import struct
from typing import Any, BinaryIO, Literal

from pydantic import Field

from ..contracts.common import Digest, Record
from ..contracts.profiles import ProfileId
from .refinement_transport import CURRENT_REFINEMENT_BYTES, current_batch, write_json_frame

PAGE_CONTROL_BYTES = 8 * 1024 * 1024 + 1024
REFINEMENT_CONTROL_BYTES = 24 * 1024 * 1024 + 1024
TERMINAL_CONTROL_BYTES = 256 * 1024 + 1024
REPLY_BYTES = 64 * 1024 * 1024 + 1024
TOTAL_REPLY_BYTES = 64 * 1024 * 1024 + 25533 * 1024
ExchangeKind = Literal[
    "page", "recognition", "refinement_batch", "refinement", "artifacts", "refusal"
]
ExchangeKind2 = ExchangeKind | Literal["word_wrap_batch", "word_wrap"]


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


class Exchange2(Record):
    schema_version: Literal["ava-reconstruction-exchange-2"]
    sequence: int = Field(ge=1, le=25600)
    source_sha256: Digest
    profile_id: ProfileId
    kind: ExchangeKind2
    payload: Any


def _exact(stream: BinaryIO, size: int) -> bytes:
    result = bytearray()
    while len(result) < size:
        data = stream.read(size - len(result))
        if not data:
            raise ValueError("Truncated attempt reply or EOF")
        result.extend(data)
    return bytes(result)


def _read_exchange(
    stream: BinaryIO, bound: int, version: Literal[1, 2] = 1
) -> tuple[Exchange | Exchange2, int]:
    size = struct.unpack(">I", _exact(stream, 4))[0]
    if not 0 < size <= bound:
        raise ValueError("Attempt reply byte bound exceeded")
    raw = strict_json(_exact(stream, size))
    return (
        Exchange2.model_validate(raw) if version == 2 else Exchange.model_validate(raw)
    ), size + 4


def read_exchange(stream: BinaryIO) -> Exchange:
    value = _read_exchange(stream, REPLY_BYTES)[0]
    assert isinstance(value, Exchange)
    return value


def write_bytes(stream: BinaryIO, data: bytes) -> None:
    offset = 0
    while offset < len(data):
        written = stream.write(data[offset : offset + 1024 * 1024])
        if written is None or written <= 0:
            raise ValueError("Attempt output ended before complete bytes")
        offset += written
    stream.flush()


class ExchangeWriter:
    def __init__(
        self,
        stream: BinaryIO,
        source_sha256: str,
        profile_id: ProfileId,
        *,
        version: Literal[1, 2] = 1,
        current_refinement: bool = False,
    ):
        if type(version) is not int or version not in {1, 2}:
            raise ValueError("Unknown attempt exchange version")
        if type(current_refinement) is not bool or (current_refinement and version != 2):
            raise ValueError("Current refinement requires captured continuation exchange")
        self.current_refinement: bool = current_refinement
        self.stream: BinaryIO = stream
        self.source_sha256: str = source_sha256
        self.profile_id: ProfileId = profile_id
        self.sequence: int = 0
        self.terminal: bool = False
        self._reply_bytes: int = 0
        self._anchor_context_parents: set[str] = set()
        self.version: Literal[1, 2] = version

    def emit(self, kind: ExchangeKind2, payload: Any) -> Exchange | Exchange2:
        if self.terminal:
            raise ValueError("Attempt control follows terminal marker")
        model = Exchange2 if self.version == 2 else Exchange
        packet = model.model_validate(
            dict(
                schema_version="ava-reconstruction-exchange-2"
                if self.version == 2
                else "ava-reconstruction-exchange-1",
                sequence=self.sequence + 1,
                source_sha256=self.source_sha256,
                profile_id=self.profile_id,
                kind=kind,
                payload=payload,
            )
        )
        if self.current_refinement and kind == "refinement_batch" and current_batch(payload):
            write_json_frame(
                self.stream,
                packet.model_dump(mode="json"),
                CURRENT_REFINEMENT_BYTES + 1024,
                write_bytes,
                payload_bound=CURRENT_REFINEMENT_BYTES,
            )
            self.sequence = packet.sequence
            return packet
        data = json_bytes(packet.model_dump(mode="json"))
        bound = (
            PAGE_CONTROL_BYTES
            if kind in {"page", "word_wrap_batch"}
            else REFINEMENT_CONTROL_BYTES
            if kind == "refinement_batch"
            else 1024
            if kind in {"recognition", "refinement", "word_wrap"}
            else TERMINAL_CONTROL_BYTES
        )
        if len(data) > bound:
            raise ValueError("Attempt control byte bound exceeded")
        write_bytes(self.stream, struct.pack(">I", len(data)) + data)
        self.sequence = packet.sequence
        self.terminal = kind in {"artifacts", "refusal"}
        return packet

    def reply(self, stream: BinaryIO, request: Exchange | Exchange2) -> list[Any]:
        reply, size = _read_exchange(
            stream, min(REPLY_BYTES, TOTAL_REPLY_BYTES - self._reply_bytes - 4), self.version
        )
        self._reply_bytes += size
        if (
            reply.sequence != request.sequence
            or reply.schema_version != request.schema_version
            or reply.source_sha256 != self.source_sha256
            or reply.profile_id != self.profile_id
            or reply.kind != request.kind
            or request.kind
            not in {
                "page",
                "recognition",
                "refinement_batch",
                "refinement",
                "word_wrap_batch",
                "word_wrap",
            }
            or not isinstance(reply.payload, list)
        ):
            raise ValueError("Attempt reply belongs to another exchange")
        return reply.payload
