"""Bind current table captions from adjacent source boxes, never by caption wording."""

from .assembly_state import AssemblyState
from .segments import Segment
from .source_feature_geometry import same_column


def caption_gap(caption: Segment, table: Segment) -> float | None:
    if caption.page != table.page or not same_column(caption, table):
        return None
    if caption.box.y1 <= table.box.y0:
        return table.box.y0 - caption.box.y1
    if table.box.y1 <= caption.box.y0:
        return caption.box.y0 - table.box.y1
    return None


def associate_table_captions(state: AssemblyState) -> None:
    owners: dict[str, str] = {}
    for block in state.blocks:
        caption = block.get("caption_id")
        if caption is not None:
            if caption in owners:
                raise ValueError("Caption has multiple source owners")
            owners[caption] = block["id"]
    proposals: dict[str, str] = {}
    for at, block in enumerate(state.blocks):
        if block["kind"] != "caption" or block["id"] in owners:
            continue
        caption = state.segments[block["id"]]
        neighbours = state.blocks[max(0, at - 1) : at] + state.blocks[at + 1 : at + 2]
        tables = [node for node in neighbours if node["kind"] == "table"]
        if not tables:
            continue  # Standalone captions remain readable source content.
        candidates = [
            (gap, node)
            for node in tables
            if (gap := caption_gap(caption, state.segments[node["id"]])) is not None
        ]
        if not candidates:
            raise ValueError("Table caption has no source-adjacent target")
        smallest = min(gap for gap, _ in candidates)
        selected = [node for gap, node in candidates if gap == smallest]
        if len(selected) != 1:
            raise ValueError("Table caption has ambiguous source-adjacent targets")
        target = selected[0]
        if target.get("caption_id") is not None or target["id"] in proposals:
            raise ValueError("Conflicting source table captions")
        proposals[target["id"]] = block["id"]
    for block in state.blocks:
        if block["id"] in proposals:
            block["caption_id"] = proposals[block["id"]]
