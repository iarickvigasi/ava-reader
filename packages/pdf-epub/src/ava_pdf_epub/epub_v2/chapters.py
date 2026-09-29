"""One XHTML per logical chapter; list hierarchy follows canonical preorder."""

import xml.etree.ElementTree as ET

from ..contracts.blocks import ListItemBlock
from .blocks import render_block
from .context import Context, ident
from .page_anchors import add_page_anchors
from .xml import EPUB, document, element


def render_list(group_id: str, ctx: Context) -> ET.Element:
    group = ctx.groups[group_id]
    attrs = {"data-ava-list": group.id}
    if group.ordered:
        attrs["start"] = str(group.start)
    if group.marker_style is not None:
        marker = "disc" if group.marker_style == "bullet" else group.marker_style
        attrs["style"] = "list-style-type:" + marker
    root = element("ol" if group.ordered else "ul", attrs)
    for item_id in group.item_ids:
        item = render_block(item_id, ctx)
        for child in ctx.groups.values():
            if child.parent_item_id == item_id:
                item.append(render_list(child.id, ctx))
        root.append(item)
    return root


def chapter_documents(ctx: Context) -> dict[str, bytes]:
    output = {}
    seen_pages: set[int] = set()
    for chapter in ctx.book.chapters:
        body = element(
            "body", {f"{{{EPUB}}}type": chapter.role, "id": ident("chapter", chapter.id)}
        )
        emitted_groups: set[str] = set()
        for block_id in chapter.block_ids:
            block = ctx.nodes[block_id]
            if isinstance(block, ListItemBlock):
                group = ctx.groups[block.list_id]
                if group.parent_item_id is None and group.id not in emitted_groups:
                    body.append(render_list(group.id, ctx))
                    emitted_groups.add(group.id)
            else:
                body.append(render_block(block_id, ctx))
        add_page_anchors(body, ctx, seen_pages)
        output["EPUB/" + ctx.paths[chapter.id]] = document(chapter.title, body)
    return output
