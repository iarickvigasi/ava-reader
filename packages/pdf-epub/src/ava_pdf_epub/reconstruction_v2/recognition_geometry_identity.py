"""Task identity contains only strings, integer coordinates of slots and hashes."""

import hashlib
from typing import TYPE_CHECKING

from .attempt_exchange import json_bytes

if TYPE_CHECKING:
    from .recognition_geometry_contract import RecognitionGeometryTask


def geometry_digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def geometry_task_id(task: "RecognitionGeometryTask") -> str:
    projection = [
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
                slot.segment_index,
                slot.segment_id,
                slot.segment_text_sha256,
                slot.original_box_sha256,
                slot.reason,
                slot.kind,
                slot.context,
            ]
            for slot in task.slots
        ],
    ]
    return "recognition-geometry-" + geometry_digest(json_bytes(projection))
