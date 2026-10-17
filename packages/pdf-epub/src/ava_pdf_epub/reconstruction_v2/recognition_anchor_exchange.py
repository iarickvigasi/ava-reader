"""A distinct active-attempt control; historical Exchange1 remains closed and unchanged."""

import struct
from typing import Any, Literal

from pydantic import Field, ValidationError

from ..contracts.common import Digest, Record
from ..contracts.profiles import ProfileId
from .attempt_exchange import (
    PAGE_CONTROL_BYTES,
    REPLY_BYTES,
    TOTAL_REPLY_BYTES,
    ExchangeWriter,
    _exact,
    json_bytes,
    strict_json,
    write_bytes,
)
from .recognition_anchor_context import (
    RecognitionAnchorContextResponse,
    RecognitionAnchorContextTask,
    apply_anchor_context,
    prepare_anchor_context,
)
from .recognition_anchor_quote import apply_anchor_quote, prepare_anchor_quote
from .recognition_anchor_quote_contract import (
    RecognitionAnchorQuoteResponse,
    RecognitionAnchorQuoteTask,
)
from .recognition_contract import RecognitionTask
from .source_refusal import refuse_task
from .validate_tasks import validate_tasks


class AnchorContextExchange(Record):
    schema_version: Literal["ava-recognition-anchor-context-exchange-1"]
    sequence: int = Field(ge=1, le=25534)
    source_sha256: Digest
    profile_id: ProfileId
    kind: Literal["anchor_context"]
    payload: Any


class AnchorQuoteExchange(Record):
    schema_version: Literal["ava-recognition-anchor-quote-exchange-2"]
    sequence: int = Field(ge=1, le=25534)
    source_sha256: Digest
    profile_id: ProfileId
    kind: Literal["anchor_quote"]
    payload: Any


def emit_context(
    writer: ExchangeWriter, task: RecognitionAnchorContextTask | RecognitionAnchorQuoteTask
) -> AnchorContextExchange | AnchorQuoteExchange:
    parents = writer._anchor_context_parents
    if writer.terminal or task.original_task_id in parents:
        raise ValueError("ANCHOR_CONTEXT_SECOND_PASS_REFUSED")
    parents.add(
        task.original_task_id
    )  # Consume before output; interruption cannot invite a resend.
    if isinstance(task, RecognitionAnchorQuoteTask):
        packet: AnchorContextExchange | AnchorQuoteExchange = AnchorQuoteExchange(
            schema_version="ava-recognition-anchor-quote-exchange-2",
            sequence=writer.sequence + 1,
            source_sha256=writer.source_sha256,
            profile_id=writer.profile_id,
            kind="anchor_quote",
            payload=task.model_dump(mode="json"),
        )
    else:
        packet = AnchorContextExchange(
            schema_version="ava-recognition-anchor-context-exchange-1",
            sequence=writer.sequence + 1,
            source_sha256=writer.source_sha256,
            profile_id=writer.profile_id,
            kind="anchor_context",
            payload=task.model_dump(mode="json"),
        )
    data = json_bytes(packet.model_dump(mode="json"))
    if len(data) > PAGE_CONTROL_BYTES:
        raise ValueError("ANCHOR_CONTEXT_CONTROL_BOUND")
    write_bytes(writer.stream, struct.pack(">I", len(data)) + data)
    writer.sequence = packet.sequence
    return packet


def reply_context(
    writer: ExchangeWriter, incoming: Any, request: AnchorContextExchange | AnchorQuoteExchange
) -> Any:
    size = struct.unpack(">I", _exact(incoming, 4))[0]
    if (
        not 0
        < size
        <= min(1024 * 1024 + 1024, REPLY_BYTES, TOTAL_REPLY_BYTES - writer._reply_bytes - 4)
    ):
        raise ValueError("ANCHOR_CONTEXT_REPLY_BOUND")
    reply = type(request).model_validate(strict_json(_exact(incoming, size)))
    writer._reply_bytes += size + 4
    if (
        reply.sequence != request.sequence
        or reply.source_sha256 != writer.source_sha256
        or reply.profile_id != writer.profile_id
        or not isinstance(reply.payload, list)
        or len(reply.payload) != 1
    ):
        raise ValueError("ANCHOR_CONTEXT_REPLY_BINDING_DIFFERS")
    return reply.payload[0]


def accept_attempt_recognition(
    task: RecognitionTask,
    raw_response: Any,
    writer: ExchangeWriter,
    incoming: Any,
    allow_correction: bool,
) -> Any:
    data = json_bytes(
        {
            "mode": "validate_tasks",
            "tasks": [task.model_dump(mode="json")],
            "responses": [raw_response],
        }
    )
    try:
        validate_tasks(data)
        return raw_response
    except ValidationError:
        if not allow_correction:
            raise
    # Select the repair before dispatch: quotation repair replaces, never follows, V1.
    quote_task = prepare_anchor_quote(task, json_bytes(raw_response).decode())
    if any(
        any(
            q != strict_json(s.original_span_json.encode())["anchor"]["exact_text"]
            for q in s.allowed_quotations
        )
        for s in quote_task.slots
    ):
        packet = emit_context(writer, quote_task)
        quote_reply = RecognitionAnchorQuoteResponse.model_validate(
            reply_context(writer, incoming, packet)
        )
        if quote_reply.outcome == "unresolved":
            if (
                quote_reply.task_id,
                quote_reply.source_sha256,
                quote_reply.original_task_id,
                quote_reply.render_sha256,
                quote_reply.original_response_sha256,
            ) != (
                quote_task.task_id,
                quote_task.source_sha256,
                quote_task.original_task_id,
                quote_task.render_sha256,
                quote_task.original_response_sha256,
            ):
                raise ValueError("ANCHOR_QUOTE_UNRESOLVED_BINDING_DIFFERS")
            refuse_task(task, "RECOGNITION_UNRESOLVED")
        return apply_anchor_quote(task, quote_task, quote_reply)
    # Constructor classifies only finite anchor failures and verifies immutable parent semantics.
    context = prepare_anchor_context(task, json_bytes(raw_response).decode())
    packet = emit_context(writer, context)
    correction = RecognitionAnchorContextResponse.model_validate(
        reply_context(writer, incoming, packet)
    )
    if correction.outcome == "unresolved":
        # Validate even an unresolved reply's full source/task/response binding before refusal.
        if (
            correction.task_id,
            correction.source_sha256,
            correction.original_task_id,
            correction.render_sha256,
            correction.original_response_sha256,
        ) != (
            context.task_id,
            context.source_sha256,
            context.original_task_id,
            context.render_sha256,
            context.original_response_sha256,
        ):
            raise ValueError("ANCHOR_CONTEXT_UNRESOLVED_BINDING_DIFFERS")
        refuse_task(task, "RECOGNITION_UNRESOLVED")
    return apply_anchor_context(task, context, correction)
