"""Prepare a bound request and apply only complete, ordered segment-box patches."""

import copy
from typing import Any

from .attempt_exchange import json_bytes
from .recognition_contract import RecognitionTask
from .recognition_geometry_contract import RecognitionGeometryResponse, RecognitionGeometryTask
from .recognition_geometry_eligibility import geometry_slots, validate_geometry_parent
from .recognition_geometry_identity import geometry_digest, geometry_task_id
from .recognition_geometry_parent import canonical_geometry_parent as canonical_geometry_parent
from .recognition_geometry_prompt import GEOMETRY_PROMPT_VERSION
from .validate_tasks import validate_tasks


def prepare_geometry_repair(
    original_task: RecognitionTask,
    original_response_json: str,
) -> RecognitionGeometryTask:
    original_task = RecognitionTask.model_validate(original_task.model_dump())
    parent = canonical_geometry_parent(original_response_json)
    validate_geometry_parent(original_task, parent)
    fields: dict[str, Any] = dict(
        schema_version="ava-recognition-geometry-task-1",
        task_id="pending",
        purpose="repair_recognition_geometry",
        prompt_version=GEOMETRY_PROMPT_VERSION,
        response_schema_version="ava-recognition-geometry-response-1",
        source_sha256=original_task.source_sha256,
        profile_id=original_task.profile_id,
        page_number=original_task.page_number,
        original_task_id=original_task.task_id,
        render_sha256=original_task.image.sha256,
        native_evidence_sha256=original_task.native_evidence_sha256,
        image=original_task.image,
        original_response_json=original_response_json,
        original_response_sha256=geometry_digest(original_response_json.encode()),
        slots=geometry_slots(parent),
    )
    temporary = RecognitionGeometryTask.model_construct(**fields)
    fields["task_id"] = geometry_task_id(temporary)
    return RecognitionGeometryTask.model_validate(fields)


def apply_geometry_repair(
    original_task: RecognitionTask,
    task: RecognitionGeometryTask,
    response: RecognitionGeometryResponse,
) -> dict[str, Any]:
    original_task = RecognitionTask.model_validate(original_task.model_dump())
    task = RecognitionGeometryTask.model_validate(task.model_dump())
    response = RecognitionGeometryResponse.model_validate(response.model_dump())
    expected = prepare_geometry_repair(original_task, task.original_response_json)
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
        raise ValueError("GEOMETRY_CORRECTION_BINDING_DIFFERS")
    if response.outcome != "corrected":
        raise ValueError("GEOMETRY_UNRESOLVED")
    if [patch.segment_id for patch in response.patches] != [slot.segment_id for slot in task.slots]:
        raise ValueError("GEOMETRY_PATCH_COVERAGE_DIFFERS")
    patched = copy.deepcopy(canonical_geometry_parent(task.original_response_json))
    for slot, patch in zip(task.slots, response.patches, strict=True):
        patched["segments"][slot.segment_index]["box"] = patch.box.model_dump(mode="json")
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
