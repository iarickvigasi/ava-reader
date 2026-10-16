"""Exact source-bound cell slots; only requested boxes may change, with full validation."""

import base64
import copy
from typing import Any

from .attempt_exchange import json_bytes
from .recognition_cell_geometry_contract import (
    CELL_GEOMETRY_PROMPT_VERSION,
    RecognitionCellGeometryResponse,
    RecognitionCellGeometryTask,
)
from .recognition_cell_geometry_eligibility import (
    cell_geometry_slots,
    validate_cell_geometry_parent,
)
from .recognition_contract import RecognitionTask
from .recognition_geometry_identity import geometry_digest
from .recognition_geometry_parent import canonical_geometry_parent
from .validate_tasks import validate_tasks


def cell_geometry_task_id(task: RecognitionCellGeometryTask) -> str:
    fields = [
        task.schema_version,
        task.purpose,
        task.prompt_version,
        task.response_schema_version,
        task.source_sha256,
        task.profile_id,
        task.page_number,
        task.original_task_id,
        task.render_sha256,
        task.native_evidence_sha256,
        task.original_response_sha256,
        task.image.byte_length,
        task.image.width,
        task.image.height,
        [
            [
                s.slot_id,
                s.segment_index,
                s.segment_id,
                s.row_index,
                s.cell_index,
                s.cell_text_sha256,
                s.original_box_sha256,
                s.context,
                s.row_context,
            ]
            for s in task.slots
        ],
    ]
    return "recognition-cell-geometry-" + geometry_digest(json_bytes(fields))


def validate_cell_geometry_task(task: RecognitionCellGeometryTask) -> None:
    raw = task.original_response_json.encode()
    pixels = base64.b64decode(task.image.base64, validate=True)
    if (
        len(raw) > 8 * 1024**2
        or geometry_digest(raw) != task.original_response_sha256
        or len(pixels) != task.image.byte_length
        or geometry_digest(pixels) != task.image.sha256
        or task.image.sha256 != task.render_sha256
    ):
        raise ValueError("CELL_GEOMETRY_BYTES_DIFFER")
    parent = canonical_geometry_parent(task.original_response_json)
    if (parent.get("task_id"), parent.get("source_sha256"), parent.get("render_sha256")) != (
        task.original_task_id,
        task.source_sha256,
        task.render_sha256,
    ):
        raise ValueError("CELL_GEOMETRY_PARENT_DIFFERS")
    if cell_geometry_slots(parent) != task.slots or cell_geometry_task_id(task) != task.task_id:
        raise ValueError("CELL_GEOMETRY_SLOTS_OR_ID_DIFFER")


def prepare_cell_geometry_repair(
    original_task: RecognitionTask,
    original_response_json: str,
) -> RecognitionCellGeometryTask:
    original_task = RecognitionTask.model_validate(original_task.model_dump())
    parent = canonical_geometry_parent(original_response_json)
    validate_cell_geometry_parent(original_task, parent)
    fields: dict[str, Any] = dict(
        schema_version="ava-recognition-cell-geometry-task-1",
        task_id="pending",
        purpose="repair_recognition_cell_geometry",
        prompt_version=CELL_GEOMETRY_PROMPT_VERSION,
        response_schema_version="ava-recognition-cell-geometry-response-1",
        source_sha256=original_task.source_sha256,
        profile_id=original_task.profile_id,
        page_number=original_task.page_number,
        original_task_id=original_task.task_id,
        render_sha256=original_task.image.sha256,
        native_evidence_sha256=original_task.native_evidence_sha256,
        image=original_task.image,
        original_response_json=original_response_json,
        original_response_sha256=geometry_digest(original_response_json.encode()),
        slots=cell_geometry_slots(parent),
    )
    fields["task_id"] = cell_geometry_task_id(RecognitionCellGeometryTask.model_construct(**fields))
    return RecognitionCellGeometryTask.model_validate(fields)


def apply_cell_geometry_repair(
    original_task: RecognitionTask,
    task: RecognitionCellGeometryTask,
    response: RecognitionCellGeometryResponse,
) -> dict[str, Any]:
    original_task = RecognitionTask.model_validate(original_task.model_dump())
    task = RecognitionCellGeometryTask.model_validate(task.model_dump())
    response = RecognitionCellGeometryResponse.model_validate(response.model_dump())
    expected = prepare_cell_geometry_repair(original_task, task.original_response_json)
    if expected != task or (
        response.task_id,
        response.source_sha256,
        response.original_task_id,
        response.render_sha256,
        response.original_response_sha256,
    ) != (
        task.task_id,
        task.source_sha256,
        task.original_task_id,
        task.render_sha256,
        task.original_response_sha256,
    ):
        raise ValueError("CELL_GEOMETRY_CORRECTION_BINDING_DIFFERS")
    if response.outcome != "corrected":
        raise ValueError("CELL_GEOMETRY_UNRESOLVED")
    if [p.slot_id for p in response.patches] != [s.slot_id for s in task.slots]:
        raise ValueError("CELL_GEOMETRY_PATCH_COVERAGE_DIFFERS")
    patched = copy.deepcopy(canonical_geometry_parent(task.original_response_json))
    for slot, patch in zip(task.slots, response.patches, strict=True):
        patched["segments"][slot.segment_index]["cells"][slot.row_index][slot.cell_index]["box"] = (
            patch.box.model_dump(mode="json")
        )
    validate_tasks(
        json_bytes(
            {
                "mode": "validate_tasks",
                "tasks": [original_task.model_dump(mode="json")],
                "responses": [patched],
            }
        )
    )
    return patched
