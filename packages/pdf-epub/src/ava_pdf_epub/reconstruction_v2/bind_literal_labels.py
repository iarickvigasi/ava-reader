"""Bind measured columns after final text and semantic links have been assembled."""

from typing import Any

from .assemble_links import assemble_links
from .assembly_state import AssemblyState
from .findings import Finding


def assemble_links_with_labels(state: AssemblyState, chapters: list[dict[str, Any]]) -> None:
    assemble_links(state, chapters)
    bind_literal_labels(state)


def bind_literal_labels(state: AssemblyState) -> None:
    groups = {g["id"]: g for g in state.lists}
    for block in state.blocks:
        measured = state.literal_label_geometry.get(block["id"])
        if measured is None or block["kind"] != "list_item":
            continue
        prefix, width = measured
        content = block["content"]
        if groups[block["list_id"]]["marker_style"] != "none":
            continue
        end = len(prefix)
        changed = not content["text"].startswith(prefix)
        crossing = any(s.get("link") and 0 < s["start"] < end < s["end"] for s in content["spans"])
        if changed or crossing:
            state.structure_findings.append(
                Finding(
                    code="LITERAL_LABEL_COLUMN_UNPROJECTED",
                    severity="information",
                    message="Measured label column could not preserve its exact "
                    "final text/link ranges; "
                    "literal text and semantic links remain intact.",
                )
            )
            continue
        block["literal_label"] = dict(prefix_end=end, column_em=width)
