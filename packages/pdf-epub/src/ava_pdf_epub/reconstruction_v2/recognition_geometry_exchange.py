"""Geometry has a new control namespace and consumes the existing correction opportunity."""

import struct
from typing import Any, Literal

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
from .recognition_geometry_contract import RecognitionGeometryTask


class RecognitionGeometryExchange(Record):
    schema_version: Literal["ava-recognition-geometry-exchange-1"]
    sequence: int = Field(ge=1, le=25600)
    source_sha256: Digest
    profile_id: ProfileId
    kind: Literal["geometry"]
    payload: Any


def emit_geometry(
    writer: ExchangeWriter, task: RecognitionGeometryTask
) -> RecognitionGeometryExchange:
    if (
        writer.version != 2
        or writer.terminal
        or task.original_task_id in writer._anchor_context_parents
    ):
        raise ValueError("GEOMETRY_SECOND_PASS_REFUSED")
    writer._anchor_context_parents.add(task.original_task_id)
    packet = RecognitionGeometryExchange(
        schema_version="ava-recognition-geometry-exchange-1",
        sequence=writer.sequence + 1,
        source_sha256=writer.source_sha256,
        profile_id=writer.profile_id,
        kind="geometry",
        payload=task.model_dump(mode="json"),
    )
    data = json_bytes(packet.model_dump(mode="json"))
    if len(data) > 24 * 1024 * 1024 + 1024:
        raise ValueError("GEOMETRY_CONTROL_BOUND")
    write_bytes(writer.stream, struct.pack(">I", len(data)) + data)
    writer.sequence = packet.sequence
    return packet


def reply_geometry(
    writer: ExchangeWriter, incoming: Any, request: RecognitionGeometryExchange
) -> Any:
    size = struct.unpack(">I", _exact(incoming, 4))[0]
    if (
        not 0
        < size
        <= min(1024 * 1024 + 1024, REPLY_BYTES, TOTAL_REPLY_BYTES - writer._reply_bytes - 4)
    ):
        raise ValueError("GEOMETRY_REPLY_BOUND")
    reply = RecognitionGeometryExchange.model_validate(strict_json(_exact(incoming, size)))
    writer._reply_bytes += size + 4
    if (
        reply.sequence != request.sequence
        or reply.source_sha256 != writer.source_sha256
        or reply.profile_id != writer.profile_id
        or not isinstance(reply.payload, list)
        or len(reply.payload) != 1
    ):
        raise ValueError("GEOMETRY_REPLY_BINDING_DIFFERS")
    return reply.payload[0]
