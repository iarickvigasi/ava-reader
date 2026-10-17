"""Authenticate exact original bytes, image and the complete immutable slot list."""

import base64
from typing import TYPE_CHECKING

from .recognition_geometry_eligibility import geometry_slots
from .recognition_geometry_identity import geometry_digest, geometry_task_id
from .recognition_geometry_parent import canonical_geometry_parent

if TYPE_CHECKING:
    from .recognition_geometry_contract import RecognitionGeometryTask


def validate_geometry_task(task: "RecognitionGeometryTask") -> None:
    raw = task.original_response_json.encode()
    pixels = base64.b64decode(task.image.base64, validate=True)
    if (
        geometry_digest(raw) != task.original_response_sha256
        or len(pixels) != task.image.byte_length
        or geometry_digest(pixels) != task.image.sha256
        or task.image.sha256 != task.render_sha256
    ):
        raise ValueError("GEOMETRY_BYTES_DIFFER")
    parent = canonical_geometry_parent(task.original_response_json)
    if (
        parent.get("task_id"),
        parent.get("source_sha256"),
        parent.get("render_sha256"),
    ) != (task.original_task_id, task.source_sha256, task.render_sha256):
        raise ValueError("GEOMETRY_PARENT_DIFFERS")
    if geometry_slots(parent) != task.slots:
        raise ValueError("GEOMETRY_SLOTS_DIFFER")
    if geometry_task_id(task) != task.task_id:
        raise ValueError("GEOMETRY_ID_DIFFERS")
