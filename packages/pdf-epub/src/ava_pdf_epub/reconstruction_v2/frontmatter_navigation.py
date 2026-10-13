"""Document title and source aliases provide frontmatter navigation without cover fragments."""

from typing import Any

from .assembly_state import AssemblyState
from .printed_title_claim import printed_title_claim


def frontmatter_navigation(
    state: AssemblyState,
    chapters: list[dict[str, Any]],
    toc: list[dict[str, Any]],
    addresses: list[dict[str, Any]],
) -> None:
    if state.source_title_policy != "ava-frontmatter-title-1":
        return
    front = {c["id"]: c for c in chapters if c["role"] == "frontmatter"}
    if not front:
        return
    # Selectable blocks, levels and styles are untouched. Only navigation labels are replaced.
    toc[:] = [entry for entry in toc if entry["target"]["chapter_id"] not in front]
    claim = printed_title_claim(state)
    selected = state.frontmatter_title[0] if state.frontmatter_title is not None else None
    for chapter in front.values():
        primary = selected in chapter["block_ids"] if selected else False
        chapter["title"] = claim["value"] if primary and claim else "Front matter"
        if primary and claim:
            target = dict(kind="internal", chapter_id=chapter["id"], block_id=selected, offset=0)
            label = claim["value"]
        else:
            local = [
                a
                for a in addresses
                if "source_page" in a and a["target"]["chapter_id"] == chapter["id"]
            ]
            if not local:
                raise ValueError("Frontmatter navigation lacks a checked source-page destination")
            # Source page order, rather than a content search, chooses the opening address.
            target = dict(min(local, key=lambda address: address["source_page"])["target"])
            label = "Front matter"
        toc.append(dict(id="toc-" + chapter["id"], label=label, target=target))

    positions = {block["id"]: index for index, block in enumerate(state.blocks)}
    toc.sort(key=lambda entry: (positions[entry["target"]["block_id"]], entry["target"]["offset"]))
