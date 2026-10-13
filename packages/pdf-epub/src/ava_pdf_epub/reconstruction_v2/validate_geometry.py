"""Rebuild repair eligibility under the same pinned worker before any paid correction."""

from typing import Any

from .attempt_exchange import strict_json
from .recognition_contract import RecognitionTask
from .recognition_geometry_contract import RecognitionGeometryResponse, RecognitionGeometryTask
from .recognition_geometry_identity import geometry_digest
from .recognition_geometry_repair import apply_geometry_repair, prepare_geometry_repair


def validate_geometry(data: bytes) -> dict[str, Any]:
    if not 0 < len(data) <= 24 * 1024 * 1024:
        raise ValueError("GEOMETRY_VALIDATION_BOUND")
    raw = strict_json(data)
    if (
        not isinstance(raw, dict)
        or set(raw) != {"mode", "task", "original", "response"}
        or raw["mode"] != "validate_geometry"
    ):
        raise ValueError("GEOMETRY_VALIDATION_FIELDS")
    original = RecognitionTask.model_validate(raw["original"])
    task = RecognitionGeometryTask.model_validate(raw["task"])
    if task != prepare_geometry_repair(original, task.original_response_json):
        raise ValueError("GEOMETRY_VALIDATION_BINDING_DIFFERS")
    if raw["response"] is not None:
        apply_geometry_repair(
            original, task, RecognitionGeometryResponse.model_validate(raw["response"])
        )
    return {
        "schema_version": "ava-recognition-geometry-validation-1",
        "valid": True,
        "request_sha256": geometry_digest(data),
    }
