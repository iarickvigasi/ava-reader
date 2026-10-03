"""Keep ordered starts and nested membership rather than flattening visible list items."""

from typing import Any

from .assembly_state import AssemblyState


def assemble_lists(state: AssemblyState, chapters: list[dict[str, Any]]) -> None:
    for chapter in chapters:
        stack: dict[int, dict[str, Any]] = {}
        previous: dict[int, str] = {}
        for block in (b for b in state.blocks if b["id"] in chapter["block_ids"]):
            if block["kind"] != "list_item":
                stack.clear()
                previous.clear()
                continue
            segment = state.segments[block["id"]]
            depth = segment.list_depth or 1
            ordered = bool(segment.list_ordered)
            group = stack.get(depth)
            if depth > 1 and depth - 1 not in previous:
                raise ValueError("Nested list has no source parent")
            if group is None or group["ordered"] != ordered:
                group = dict(
                    id=f"list-{len(state.lists)}",
                    ordered=ordered,
                    marker_style=state.marker_styles.get(block["id"]),
                    start=(segment.list_start if segment.list_start is not None else 1)
                    if ordered
                    else None,
                    depth=depth,
                    parent_item_id=previous.get(depth - 1),
                    item_ids=[],
                )
                state.lists.append(group)
                stack[depth] = group
            elif (
                ordered
                and segment.list_start is not None
                and segment.list_start != group["start"] + len(group["item_ids"])
            ):
                raise ValueError("List numbering discontinuity needs explicit structure review")
            block["list_id"] = group["id"]
            group["item_ids"].append(block["id"])
            previous[depth] = block["id"]
            for key in list(stack):
                if key > depth:
                    del stack[key]
