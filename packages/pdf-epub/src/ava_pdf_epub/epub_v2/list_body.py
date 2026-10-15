"""List body displacement stays separate from marker and literal-column layout."""

import xml.etree.ElementTree as ET

from ..contracts.blocks import ListItemBlock
from .context import Context
from .xml import element


def list_body(block: ListItemBlock, text: ET.Element, ctx: Context) -> ET.Element:
    attrs = {"data-ava-list-body": block.id}
    style = ctx.styles.get(block.style_id) if block.style_id is not None else None
    geometry = []
    if block.literal_label is not None:
        # The measured prefix owns its own hanging column, not old paragraph geometry.
        geometry = ["text-indent:0", "margin-inline-start:0"]
    elif style is not None:
        for key, css in [("indent_em", "text-indent"), ("block_indent_em", "margin-inline-start")]:
            value = getattr(style, key)
            if value is not None:
                geometry.append(f"{css}:{value:g}em")
        clearance = max(0, -((style.indent_em or 0) + (style.block_indent_em or 0)))
        if clearance:
            geometry.append(f"padding-inline-start:{clearance:g}em")
    if geometry:
        attrs["style"] = ";".join(geometry)
    body = element("div", attrs)
    body.append(text)
    return body
