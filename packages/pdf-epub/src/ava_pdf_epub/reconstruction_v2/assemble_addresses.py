"""Cover every chapter, text cell, node and inline occurrence with a qualified resource address."""

from typing import Any

from .assembly_state import AssemblyState


def assemble_addresses(
    state: AssemblyState, chapters: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    addresses = []
    nodes = {b["id"]: b for b in state.blocks}
    for chapter in chapters:
        path = chapter["resource_paths"][0]

        def add(
            fragment: str,
            block_id: str,
            offset: int = 0,
            path: str = path,
            chapter_id: str = chapter["id"],
        ) -> None:
            addresses.append(
                dict(
                    resource_path=path,
                    fragment=fragment,
                    target=dict(
                        kind="internal", chapter_id=chapter_id, block_id=block_id, offset=offset
                    ),
                )
            )

        add(chapter["id"], chapter["block_ids"][0])
        for ident in chapter["block_ids"]:
            node = nodes[ident]
            for item in [node, *node.get("cells", [])]:
                add(item["id"], item["id"])
                for span in item.get("content", {}).get("spans", []):
                    add(span["id"], item["id"], span["start"])
    return addresses
