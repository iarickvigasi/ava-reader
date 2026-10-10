"""Render block semantics without moving captions or merging canonical text."""

import xml.etree.ElementTree as ET

from ..contracts.blocks import (
    FigureBlock,
    HeadingBlock,
    NoteBlock,
    SeparatorBlock,
    TableBlock,
    TableCell,
)
from ..contracts.graph_links import TEXT_NODES
from .context import Context, ident
from .inline import render_text
from .paths import asset_path
from .tables import render_table
from .xml import EPUB, element


def render_block(block_id: str, ctx: Context) -> ET.Element:
    block = ctx.nodes[block_id]
    attrs = {"id": ident("b", block.id), "data-ava-block": block.id}
    if block.style_id is not None:
        attrs["class"] = ident("style", block.style_id)
    if isinstance(block, TableBlock):
        return render_table(block, attrs, ctx)
    if isinstance(block, FigureBlock):
        resource = ctx.resources[block.resource_id]
        descriptions = [id_ for id_ in [block.caption_id, block.credit_id] if id_]
        if descriptions:
            attrs["aria-describedby"] = " ".join(ident("b", id_) for id_ in descriptions)
        node = element("figure", attrs)
        image = element(
            "img",
            {
                "src": "../" + asset_path(resource),
                "alt": block.alt,
                "width": str(resource.width),
                "height": str(resource.height),
            },
        )
        if block.decorative:
            image.set("role", "presentation")
        node.append(image)
        return node
    if isinstance(block, SeparatorBlock):
        return element("hr", attrs)
    if not isinstance(block, TEXT_NODES) or isinstance(block, TableCell):
        raise ValueError("Unsupported required block")
    tag = (
        "h" + str(block.level)
        if isinstance(block, HeadingBlock)
        else {
            "quote": "blockquote",
            "aside": "aside",
            "code": "pre",
            "verse": "pre",
            "list_item": "li",
            "note": "aside",
        }.get(block.kind, "p")
    )
    if isinstance(block, NoteBlock):
        attrs[f"{{{EPUB}}}type"] = block.note_role
        attrs["aria-label"] = block.label
    if block.kind == "verse":
        attrs["class"] = (attrs.get("class", "") + " verse").strip()
    if block.kind in {"caption", "credit"}:
        attrs["class"] = (attrs.get("class", "") + " " + block.kind).strip()
        attrs["data-ava-role"] = block.kind
    node = element(tag, attrs)
    if isinstance(block, NoteBlock):
        node.append(element("span", {"data-ava-generated": "note-label"}, block.label + " "))
    node.append(render_text(block, ctx))
    if isinstance(block, NoteBlock):
        returns = element("div", {"class": "note-returns", "data-ava-generated": "returns"})
        for index, callout in enumerate(block.callout_ids):
            returns.append(
                element(
                    "a",
                    {
                        "href": ctx.backlink(callout),
                        "aria-label": f"Return to reference {index + 1}",
                    },
                    f"↩{index + 1} ",
                )
            )
        node.append(returns)
    return node
