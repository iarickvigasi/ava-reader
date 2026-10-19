"""Bind caption/credit observations; explicit relations cannot silently disappear."""

from .assembly_state import AssemblyState


def associate_figures(state: AssemblyState) -> None:
    nodes = {block["id"]: block for block in state.blocks}
    for block in state.blocks:
        target = state.segments[block["id"]].related_to
        if not target:
            continue
        destination = nodes.get(target)
        if destination is None:
            raise ValueError("Missing caption or credit target")
        if block["kind"] == "caption" and destination["kind"] in {"figure", "table"}:
            if destination.get("caption_id") not in {None, block["id"]}:
                raise ValueError("Conflicting caption association")
            destination["caption_id"] = block["id"]
        elif block["kind"] == "credit" and destination["kind"] == "figure":
            if destination.get("credit_id") not in {None, block["id"]}:
                raise ValueError("Conflicting credit association")
            destination["credit_id"] = block["id"]
        else:
            raise ValueError("Unsupported explicit source relationship")
    for node in state.blocks:
        if node["kind"] == "figure" and not node["alt"] and node["caption_id"]:
            node["alt"] = nodes[node["caption_id"]]["content"]["text"]
