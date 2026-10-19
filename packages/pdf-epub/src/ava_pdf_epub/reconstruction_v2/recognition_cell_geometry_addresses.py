"""Only exact empty/reversed or positive in-image outside-parent cell errors authorize slots."""

from collections.abc import Mapping, Sequence
from typing import Any, cast

from .recognition_fields import RecognitionBox
from .recognition_geometry_prompt import GEOMETRY_SLOT_LIMIT


def cell_geometry_addresses(
    parent: dict[str, Any], failures: Sequence[Mapping[str, Any]]
) -> set[tuple[int, int, int]]:
    addresses: set[tuple[int, int, int]] = set()
    for failure in failures:
        loc = failure["loc"]
        error = str(failure.get("ctx", {}).get("error"))
        if failure["type"] != "value_error":
            raise ValueError("CELL_GEOMETRY_NOT_ELIGIBLE")
        if (
            len(loc) == 6
            and loc[0] == "segments"
            and loc[2] == "cells"
            and loc[5] == "box"
            and all(type(loc[i]) is int for i in (1, 3, 4))
            and error == "Empty or reversed recognition box"
        ):
            addresses.add((cast(int, loc[1]), cast(int, loc[3]), cast(int, loc[4])))
        elif not (
            len(loc) == 2
            and loc[0] == "segments"
            and type(loc[1]) is int
            and error == "Table cell outside table"
        ):
            raise ValueError("CELL_GEOMETRY_NOT_ELIGIBLE")
    # Child validation can hide the segment's later containment check. Include
    # its exact finite outside cells too, then probe every other rule unchanged.
    for index, segment in enumerate(parent["segments"]):
        if segment["kind"] != "table":
            continue
        table = RecognitionBox.model_validate(segment["box"])
        for row, cells in enumerate(segment["cells"]):
            for column, cell in enumerate(cells):
                address = index, row, column
                if address in addresses:
                    continue
                if cell["box"] is None and cell.get("source_cell_id") is not None:
                    continue  # Source-pinned geometry is checked against its task, never repaired.
                box = RecognitionBox.model_validate(cell["box"])
                if not (
                    table.x0 <= box.x0 < box.x1 <= table.x1
                    and table.y0 <= box.y0 < box.y1 <= table.y1
                ):
                    addresses.add(address)
                if len(addresses) > GEOMETRY_SLOT_LIMIT:
                    raise ValueError("CELL_GEOMETRY_SLOT_BOUND")
    return addresses
