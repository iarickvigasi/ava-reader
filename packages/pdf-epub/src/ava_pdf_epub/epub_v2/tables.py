"""Rectangular table structure and explicit row/column header graphs."""

import xml.etree.ElementTree as ET

from ..contracts.blocks import TableBlock
from .context import Context, ident
from .inline import render_text
from .xml import element


def render_table(block: TableBlock, attrs: dict[str, str], ctx: Context) -> ET.Element:
    if block.caption_id:
        attrs["aria-describedby"] = ident("b", block.caption_id)
    table = element("table", attrs)
    for row in range(block.row_count):
        line = element("tr")
        for cell in (c for c in block.cells if c.row == row):
            props = {"id": ident("b", cell.id), "data-ava-cell": cell.id}
            if cell.row_span != 1:
                props["rowspan"] = str(cell.row_span)
            if cell.column_span != 1:
                props["colspan"] = str(cell.column_span)
            if cell.header_ids:
                props["headers"] = " ".join(ident("b", i) for i in cell.header_ids)
            if cell.header_axis in {"row", "column"}:
                props["scope"] = "row" if cell.header_axis == "row" else "col"
            if cell.style_id:
                props["class"] = ident("style", cell.style_id)
            item = element("th" if cell.header_axis else "td", props)
            item.append(render_text(cell, ctx))
            line.append(item)
        table.append(line)
    return table
