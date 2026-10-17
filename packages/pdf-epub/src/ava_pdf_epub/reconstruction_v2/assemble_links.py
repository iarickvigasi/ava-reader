"""Resolve note occurrences by chapter and exact printed labels; ambiguity is a blocker."""

import re
from typing import Any

from .assembly_state import AssemblyState
from .internal_links import internal_links
from .text_nodes import text_nodes


def assemble_links(state: AssemblyState, chapters: list[dict[str, Any]]) -> None:
    owners = {ident: chapter["id"] for chapter in chapters for ident in chapter["block_ids"]}
    notes = [b for b in state.blocks if b["kind"] == "note"]
    internal_links(state, owners)
    for block, parent_id, spans in text_nodes(state):
        content = block["content"]
        if block.get("kind") == "note":
            continue
        matches = [
            (m.start(), m.end(), m[1]) for m in re.finditer(r"\[([^]\s]{1,20})\]", content["text"])
        ]
        matches += [
            (s.start, s.end, s.note_label)
            for s in spans
            if s.note_label and not any(a == s.start and z == s.end for a, z, _ in matches)
        ]
        for start, end, label in matches:
            candidates = [n for n in notes if n["label"] == label]
            local = [n for n in candidates if owners[n["id"]] == owners[parent_id]]
            candidates = local or [n for n in candidates if n["note_role"] == "endnote"]
            if len(candidates) != 1:
                raise ValueError("Unresolved or ambiguous printed note callout")
            note = candidates[0]
            ident = f"{block['id']}-note{start}"
            content["spans"].append(
                dict(
                    id=ident,
                    start=start,
                    end=end,
                    style_id=None,
                    link=dict(
                        kind="note", chapter_id=owners[note["id"]], block_id=note["id"], offset=0
                    ),
                )
            )
            note["callout_ids"].append(ident)
        for match in re.finditer(r"https?://[^\s<>]+", content["text"]):
            end = match.end()
            url = match[0].rstrip(".,;)")
            end -= len(match[0]) - len(url)
            if any(
                s.get("link") and s["start"] < end and s["end"] > match.start()
                for s in content["spans"]
            ):
                continue
            content["spans"].append(
                dict(
                    id=f"{block['id']}-url{match.start()}",
                    start=match.start(),
                    end=end,
                    link=dict(kind="external", url=url),
                )
            )
    if any(not note["callout_ids"] for note in notes):
        raise ValueError("Note body has no verified source callout")
