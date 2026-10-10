"""Resolve captured source starts through checked join aliases into fixed canonical addresses."""

from typing import Any

from ..contracts.page_starts import page_fragment
from .assembly_state import AssemblyState
from .internal_links import _resolve
from .source_page_starts import SourcePageStart


def assemble_page_addresses(
    starts: dict[int, SourcePageStart],
    state: AssemblyState,
    chapters: list[dict[str, Any]],
    addresses: list[dict[str, Any]],
) -> None:
    if len(addresses) + len(starts) > 100000:
        raise ValueError("Source-page addresses exceed aggregate address bound")
    nodes = {b["id"]: b for b in state.blocks}
    owners = {ident: chapter for chapter in chapters for ident in chapter["block_ids"]}
    identities = {a["fragment"] for a in addresses}
    for number, start in starts.items():
        fragment = page_fragment(number)
        if fragment in identities:
            raise ValueError("Source-page address collides with an existing identity")
        target, offset = _resolve(start.segment_id, state)
        if target not in nodes or target not in owners or type(offset) is not int or offset < 0:
            raise ValueError("Captured source-page alias has no exact canonical owner")
        node = nodes[target]
        if not any(
            e["page"] == number and e["region_id"] == start.region_id for e in node["evidence"]
        ):
            raise ValueError("Captured source-page region disappeared during reconstruction")
        if start.text is None:
            if offset != 0 or "content" in node:
                raise ValueError("Nontext source-page start cannot become an interior text target")
        elif (
            node.get("content", {}).get("text", "")[offset : offset + len(start.text)] != start.text
        ):
            raise ValueError("Source-page alias does not retain the exact captured text")
        chapter = owners[target]
        addresses.append(
            dict(
                resource_path=chapter["resource_paths"][0],
                fragment=fragment,
                source_page=number,
                target=dict(
                    kind="internal", chapter_id=chapter["id"], block_id=target, offset=offset
                ),
            )
        )
