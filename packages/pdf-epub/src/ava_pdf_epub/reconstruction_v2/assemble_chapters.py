"""Logical chapter boundaries and qualified TOC destinations, independent of source pages."""

from typing import Any

from .assembly_state import AssemblyState


def assemble_chapters(state: AssemblyState) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    starts = [i for i, b in enumerate(state.blocks) if state.segments[b["id"]].chapter_start]
    starts = starts or [0]
    chapters = []
    toc = []
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else len(state.blocks)
        blocks = state.blocks[0 if index == 0 else start : end]
        heading = state.blocks[start]
        ident = f"chapter-{index + 1}"
        segment = state.segments[heading["id"]]
        title = heading.get("content", {}).get("text") or f"Section {index + 1}"
        chapters.append(
            dict(
                id=ident,
                title=title[:1000],
                resource_paths=[f"text/{ident}.xhtml"],
                role=segment.chapter_role or "bodymatter",
                block_ids=[b["id"] for b in blocks],
            )
        )
        parent = f"toc-{ident}"
        target = dict(kind="internal", chapter_id=ident, block_id=heading["id"], offset=0)
        toc.append(dict(id=parent, label=title[:1000], target=target))
        levels = {1: parent}
        after_opening = False
        for block in blocks:
            if block["id"] == heading["id"]:
                after_opening = True
                continue
            if block["kind"] == "heading" and after_opening:
                block["level"] = max(2, block["level"])
                level = block["level"]
                ancestor = levels[max(key for key in levels if key < level)]
                child = f"toc-{block['id']}"
                toc.append(
                    dict(
                        id=child,
                        label=block["content"]["text"][:1000],
                        parent_id=ancestor,
                        target={**target, "block_id": block["id"]},
                    )
                )
                levels = {key: value for key, value in levels.items() if key < level}
                levels[level] = child
    return chapters, toc
