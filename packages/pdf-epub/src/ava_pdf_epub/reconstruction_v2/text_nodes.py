"""Expose body and table-cell text with their containing source segment and chapter."""

from collections.abc import Iterator
from typing import Any

from .assembly_state import AssemblyState
from .segments import ObservedSpan


def text_nodes(state: AssemblyState) -> Iterator[tuple[dict[str, Any], str, list[ObservedSpan]]]:
    for block in state.blocks:
        segment = state.segments[block["id"]]
        if block.get("content"):
            yield block, block["id"], segment.spans
        for cell in block.get("cells", []):
            observed = segment.cells[cell["row"]][cell["column"]]
            yield cell, block["id"], observed.spans
