"""Segment styles and offsets while keeping each semantic link one focusable anchor."""

import xml.etree.ElementTree as ET

from ..contracts.graph_links import TextNode
from ..contracts.links import NoteTarget
from .context import Context, ident
from .xml import EPUB, append_text, element


def render_text(node: TextNode, ctx: Context) -> ET.Element:
    content = node.content
    root = element("span", {"data-ava-text": node.id})
    positions = {0, len(content.text), *ctx.offsets.get(node.id, set())}
    for span in content.spans:
        positions.update([span.start, span.end])
    ordered = sorted(positions)
    link_id: str | None = None
    link_parent = root
    for i, start in enumerate(ordered):
        active = [span for span in content.spans if span.start <= start < span.end]
        link_span = next((span for span in active if span.link is not None), None)
        current_id = link_span.id if link_span is not None else None
        if current_id != link_id:
            link_id, link_parent = current_id, root
            if link_span is not None and link_span.link is not None:
                attrs = {"href": ctx.href(link_span.link)}
                if isinstance(link_span.link, NoteTarget):
                    attrs[f"{{{EPUB}}}type"] = "noteref"
                link_parent = element("a", attrs)
                root.append(link_parent)
        if start in ctx.offsets.get(node.id, set()):
            link_parent.append(element("span", {"id": ident("loc", node.id) + f"-{start}"}))
        for span in content.spans:
            if span.start == start:
                link_parent.append(element("span", {"id": ident("s", span.id)}))
        if i + 1 == len(ordered):
            continue
        parent = link_parent
        for span in active:
            if span.style_id is not None:
                child = element("span", {"class": ident("style", span.style_id)})
                parent.append(child)
                parent = child
        append_text(parent, content.text[start : ordered[i + 1]])
    return root
