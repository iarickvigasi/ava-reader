"""Input6 preserves exact provider bytes and permits only the finite box repair."""

from typing import Any, Literal

from pydantic import ValidationError

from ..contracts.common import Digest, Record
from .attempt_exchange import ExchangeWriter, json_bytes
from .recognition_anchor_exchange import accept_attempt_recognition
from .recognition_cell_geometry_contract import (
    RecognitionCellGeometryProof,
    RecognitionCellGeometryResponse,
)
from .recognition_cell_geometry_repair import (
    apply_cell_geometry_repair,
    prepare_cell_geometry_repair,
)
from .recognition_contract import RecognitionTask
from .recognition_geometry_contract import RecognitionGeometryProof, RecognitionGeometryResponse
from .recognition_geometry_exchange import emit_geometry, reply_geometry
from .recognition_geometry_identity import geometry_digest
from .recognition_geometry_repair import (
    apply_geometry_repair,
    canonical_geometry_parent,
    prepare_geometry_repair,
)
from .source_refusal import refuse_task
from .validate_tasks import validate_tasks


class RecognitionAttemptReply(Record):
    schema_version: Literal["ava-recognition-attempt-reply-1"]
    response: Any
    original_response_json: str
    original_response_sha256: Digest


def accept_geometry_attempt(
    task: RecognitionTask,
    raw_reply: Any,
    writer: ExchangeWriter,
    incoming: Any,
    allow_cells: bool = False,
    allow_overflow: bool = False,
) -> tuple[Any, RecognitionGeometryProof | RecognitionCellGeometryProof | None]:
    reply = RecognitionAttemptReply.model_validate(raw_reply)
    parent = canonical_geometry_parent(reply.original_response_json)
    if (
        geometry_digest(reply.original_response_json.encode()) != reply.original_response_sha256
        or parent != reply.response
    ):
        raise ValueError("GEOMETRY_ORIGINAL_RECEIPT_DIFFERS")
    data = json_bytes(
        {"mode": "validate_tasks", "tasks": [task.model_dump(mode="json")], "responses": [parent]}
    )
    try:
        validate_tasks(data)
        return parent, None
    except ValidationError:
        pass
    # Each classifier is read-only; there is only one exchange after eligibility.
    # Mixed segment/cell defects remain ineligible, never two correction attempts.
    if allow_cells:
        try:
            cell_task = prepare_cell_geometry_repair(task, reply.original_response_json)
        except ValueError:
            pass
        else:
            packet = emit_geometry(writer, cell_task)
            cell_response = RecognitionCellGeometryResponse.model_validate(
                reply_geometry(writer, incoming, packet)
            )
            # apply validates full binding before refusing unresolved or accepting patches.
            if cell_response.outcome == "unresolved":
                if (
                    cell_response.task_id,
                    cell_response.source_sha256,
                    cell_response.original_task_id,
                    cell_response.render_sha256,
                    cell_response.original_response_sha256,
                ) != (
                    cell_task.task_id,
                    cell_task.source_sha256,
                    cell_task.original_task_id,
                    cell_task.render_sha256,
                    cell_task.original_response_sha256,
                ):
                    raise ValueError("CELL_GEOMETRY_UNRESOLVED_BINDING_DIFFERS")
                refuse_task(task, "RECOGNITION_UNRESOLVED")
            patched = apply_cell_geometry_repair(task, cell_task, cell_response)
            return patched, RecognitionCellGeometryProof(
                original_response_json=reply.original_response_json,
                original_response_sha256=reply.original_response_sha256,
                response=cell_response,
            )
    # A nongeometry failure still uses the historical narrow context classifier.
    try:
        correction = prepare_geometry_repair(task, reply.original_response_json)
    except ValueError:
        return accept_attempt_recognition(
            task, parent, writer, incoming, True, allow_overflow
        ), None
    packet = emit_geometry(writer, correction)
    response = RecognitionGeometryResponse.model_validate(reply_geometry(writer, incoming, packet))
    if response.outcome == "unresolved":
        if (
            response.task_id,
            response.source_sha256,
            response.original_task_id,
            response.render_sha256,
            response.original_response_sha256,
        ) != (
            correction.task_id,
            correction.source_sha256,
            correction.original_task_id,
            correction.render_sha256,
            correction.original_response_sha256,
        ):
            raise ValueError("GEOMETRY_UNRESOLVED_BINDING_DIFFERS")
        refuse_task(task, "RECOGNITION_UNRESOLVED")
    patched = apply_geometry_repair(task, correction, response)
    proof = RecognitionGeometryProof(
        original_response_json=reply.original_response_json,
        original_response_sha256=reply.original_response_sha256,
        response=response,
    )
    return patched, proof
