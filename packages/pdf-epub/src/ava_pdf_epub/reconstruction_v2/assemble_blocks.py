"""Turn qualified source segments into typed content nodes, retaining every source region."""

from collections.abc import Sequence
from pathlib import Path
from typing import Any

from .assemble_figure import assemble_figure
from .assemble_table import assemble_table
from .assembly_state import AssemblyState
from .associate_figures import associate_figures
from .canonical_text import canonical_text
from .page_checkpoints import PreparedPageMap
from .prepared import PreparedPage
from .segments import Segment
from .source_refusal import refuse_segment


def assemble_blocks(
    segments: list[Segment], prepared: Sequence[PreparedPage], scratch: Path, state: AssemblyState
) -> None:
    pages = PreparedPageMap(prepared)
    for segment in segments:
        if segment.kind in {"unsupported", "furniture"}:
            refuse_segment(pages[segment.page], segment)
        block: dict[str, Any] = dict(
            id=segment.id,
            kind=segment.kind,
            style_id=state.style_id(segment.style),
            evidence=state.evidence[segment.id],
        )
        if segment.kind == "figure":
            block.update(assemble_figure(segment, pages[segment.page], scratch, state))
        elif segment.kind == "table":
            block.update(assemble_table(segment, state))
        elif segment.kind != "separator":
            block["content"] = canonical_text(
                segment.text, segment.spans, segment.source_text, segment.id, state
            )
            if segment.kind == "heading":
                block["level"] = segment.heading_level or 2
            if segment.kind == "note":
                block.update(
                    note_role=segment.note_role or "footnote",
                    label=segment.note_label,
                    callout_ids=[],
                )
            if segment.kind == "list_item":
                block["list_id"] = "pending"
        state.blocks.append(block)
    for previous, current in zip(state.blocks, state.blocks[1:], strict=False):
        if previous["kind"] == "caption" and current["kind"] == "table":
            current["caption_id"] = previous["id"]
        if previous["kind"] in {"figure", "table"} and current["kind"] == "caption":
            previous["caption_id"] = current["id"]
            if previous["kind"] == "figure" and not previous["alt"]:
                previous["alt"] = current["content"]["text"]
        if previous["kind"] == "caption" and current["kind"] == "credit":
            matches = [b for b in state.blocks if b.get("caption_id") == previous["id"]]
            if len(matches) == 1 and matches[0]["kind"] == "figure":
                matches[0]["credit_id"] = current["id"]
    associate_figures(state)
