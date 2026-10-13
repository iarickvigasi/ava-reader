"""Native controls share sequence/byte ownership, never the OCR response marker."""

import struct
from typing import Any, BinaryIO, Literal

from pydantic import Field

from ..contracts.common import Digest, Record
from ..contracts.profiles import ProfileId
from .attempt_exchange import (
    REPLY_BYTES,
    TOTAL_REPLY_BYTES,
    ExchangeWriter,
    _exact,
    json_bytes,
    strict_json,
    write_bytes,
)


class NativeStructureExchange(Record):
    schema_version: Literal["ava-native-structure-exchange-1"]
    sequence: int = Field(ge=1, le=25534)
    source_sha256: Digest
    profile_id: ProfileId
    kind: Literal["native_structure"]
    payload: Any


def emit_native(writer: ExchangeWriter, task_id: str) -> NativeStructureExchange:
    if writer.terminal:
        raise ValueError("Native structure control follows terminal marker")
    packet = NativeStructureExchange(
        schema_version="ava-native-structure-exchange-1",
        sequence=writer.sequence + 1,
        source_sha256=writer.source_sha256,
        profile_id=writer.profile_id,
        kind="native_structure",
        payload={"task_id": task_id},
    )
    data = json_bytes(packet.model_dump(mode="json"))
    if len(data) > 1024:
        raise ValueError("Native structure control byte bound exceeded")
    write_bytes(writer.stream, struct.pack(">I", len(data)) + data)
    writer.sequence = packet.sequence
    return packet


def reply_native(
    writer: ExchangeWriter, incoming: BinaryIO, request: NativeStructureExchange
) -> Any:
    size = struct.unpack(">I", _exact(incoming, 4))[0]
    if not 0 < size <= min(REPLY_BYTES, TOTAL_REPLY_BYTES - writer._reply_bytes - 4):
        raise ValueError("Native structure reply byte bound exceeded")
    reply = NativeStructureExchange.model_validate(strict_json(_exact(incoming, size)))
    writer._reply_bytes += size + 4
    if (
        reply.sequence != request.sequence
        or reply.source_sha256 != writer.source_sha256
        or reply.profile_id != writer.profile_id
        or not isinstance(reply.payload, list)
        or len(reply.payload) != 1
    ):
        raise ValueError("Native structure reply binding differs")
    return reply.payload[0]
