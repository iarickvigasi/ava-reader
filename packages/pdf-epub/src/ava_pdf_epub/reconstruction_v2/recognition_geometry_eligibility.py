"""Only empty/reversed segment boxes can request new, explicitly bounded authority."""

import copy
from typing import Any

from pydantic import ValidationError

from .attempt_exchange import json_bytes
from .recognition_contract import RecognitionResponse, RecognitionTask
from .recognition_geometry_identity import geometry_digest
from .recognition_geometry_prompt import GEOMETRY_CONTEXT_CHARACTERS, GEOMETRY_SLOT_LIMIT
from .recognition_geometry_slots import RecognitionGeometrySlot
from .validate_tasks import validate_tasks


def geometry_slots(parent: dict[str, Any]) -> list[RecognitionGeometrySlot]:
    try:
        RecognitionResponse.model_validate(copy.deepcopy(parent))
    except ValidationError as error:
        failures = error.errors(include_url=False)
    else:
        raise ValueError("GEOMETRY_ALREADY_VALID")
    indexes = set()
    for failure in failures:
        loc = failure["loc"]
        if (
            failure["type"] != "value_error"
            or len(loc) != 3
            or loc[0] != "segments"
            or not isinstance(loc[1], int)
            or loc[2] != "box"
            or str(failure.get("ctx", {}).get("error")) != "Empty or reversed recognition box"
        ):
            raise ValueError("GEOMETRY_NOT_ELIGIBLE")
        indexes.add(loc[1])
    if not 0 < len(indexes) <= GEOMETRY_SLOT_LIMIT:
        raise ValueError("GEOMETRY_SLOT_BOUND")
    shape = copy.deepcopy(parent)
    for index in indexes:
        shape["segments"][index]["box"] = _probe_box()
    # Force validators hidden by invalid box construction; this copy never becomes output.
    RecognitionResponse.model_validate(shape)
    return [_slot(parent["segments"][index], index) for index in sorted(indexes)]


def validate_geometry_parent(task: RecognitionTask, parent: dict[str, Any]) -> None:
    slots = geometry_slots(parent)
    shape = copy.deepcopy(parent)
    for slot in slots:
        shape["segments"][slot.segment_index]["box"] = _probe_box()
    validate_tasks(
        json_bytes(
            {
                "mode": "validate_tasks",
                "tasks": [task.model_dump(mode="json")],
                "responses": [shape],
            }
        )
    )


def _probe_box() -> dict[str, Any]:
    return dict(coordinate_space="render_normalized_1000", x0=0, y0=0, x1=1000, y1=1000)


def _slot(segment: dict[str, Any], index: int) -> RecognitionGeometrySlot:
    box = json_bytes(segment["box"]).decode()
    return RecognitionGeometrySlot.model_validate(
        dict(
            segment_index=index,
            segment_id=segment["id"],
            segment_text_sha256=geometry_digest(segment["text"].encode()),
            original_box_json=box,
            original_box_sha256=geometry_digest(box.encode()),
            reason="EMPTY_OR_REVERSED_BOX",
            kind=segment["kind"],
            context=segment["text"][:GEOMETRY_CONTEXT_CHARACTERS],
        )
    )
