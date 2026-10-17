"""Only unpinned cell box failures qualify; probes never replace source observations."""

import copy
from typing import Any, cast

from pydantic import ValidationError

from .attempt_exchange import json_bytes
from .recognition_cell_geometry_contract import RecognitionCellGeometrySlot
from .recognition_contract import RecognitionResponse, RecognitionTask
from .recognition_fields import RecognitionBox
from .recognition_geometry_identity import geometry_digest
from .recognition_geometry_prompt import GEOMETRY_SLOT_LIMIT
from .validate_tasks import validate_tasks


def cell_geometry_slots(parent: dict[str, Any]) -> list[RecognitionCellGeometrySlot]:
    try:
        RecognitionResponse.model_validate(copy.deepcopy(parent))
    except ValidationError as error:
        failures = error.errors(include_url=False)
    else:
        raise ValueError("CELL_GEOMETRY_ALREADY_VALID")
    addresses: set[tuple[int, int, int]] = set()
    for failure in failures:
        loc = failure["loc"]
        if (
            failure["type"] != "value_error"
            or len(loc) != 6
            or loc[0] != "segments"
            or loc[2] != "cells"
            or loc[5] != "box"
            or any(type(loc[i]) is not int for i in (1, 3, 4))
            or str(failure.get("ctx", {}).get("error")) != "Empty or reversed recognition box"
        ):
            raise ValueError("CELL_GEOMETRY_NOT_ELIGIBLE")
        addresses.add((cast(int, loc[1]), cast(int, loc[3]), cast(int, loc[4])))
    if not 0 < len(addresses) <= GEOMETRY_SLOT_LIMIT:
        raise ValueError("CELL_GEOMETRY_SLOT_BOUND")
    slots = []
    shape = copy.deepcopy(parent)
    for index, row, column in sorted(addresses):
        segment = parent["segments"][index]
        cell = segment["cells"][row][column]
        if segment["kind"] != "table" or cell.get("source_cell_id") is not None:
            raise ValueError("CELL_GEOMETRY_PINNED_OR_FOREIGN")
        table_box = RecognitionBox.model_validate(segment["box"])
        box_json = json_bytes(cell["box"]).decode()
        text_sha = geometry_digest(cell["text"].encode())
        box_sha = geometry_digest(box_json.encode())
        slot_id = "cell-geometry-" + geometry_digest(
            json_bytes([index, segment["id"], row, column, text_sha, box_sha])
        )
        slots.append(
            RecognitionCellGeometrySlot(
                slot_id=slot_id,
                segment_index=index,
                segment_id=segment["id"],
                row_index=row,
                cell_index=column,
                cell_text_sha256=text_sha,
                original_box_json=box_json,
                original_box_sha256=box_sha,
                table_box=table_box,
                context=cell["text"][:256],
                row_context=[item["text"][:256] for item in segment["cells"][row]],
            )
        )
        # Temporary positive/contained shape exposes hidden span/grid/schema defects.
        # It is never returned or accepted as corrected geometry.
        shape["segments"][index]["cells"][row][column]["box"] = table_box.model_dump(mode="json")
    RecognitionResponse.model_validate(shape)
    return slots


def validate_cell_geometry_parent(task: RecognitionTask, parent: dict[str, Any]) -> None:
    slots = cell_geometry_slots(parent)
    shape = copy.deepcopy(parent)
    for slot in slots:
        shape["segments"][slot.segment_index]["cells"][slot.row_index][slot.cell_index]["box"] = (
            slot.table_box.model_dump(mode="json")
        )
    # Measured tables, native text and annotations are NOT waived by probe geometry.
    validate_tasks(
        json_bytes(
            {
                "mode": "validate_tasks",
                "tasks": [task.model_dump(mode="json")],
                "responses": [shape],
            }
        )
    )
