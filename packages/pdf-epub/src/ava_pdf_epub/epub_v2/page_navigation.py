"""Physical source order and hrefs come from the one validated explicit map."""

import xml.etree.ElementTree as ET

from .context import Context
from .xml import element


def source_page_listing(ctx: Context) -> ET.Element:
    listing = element("ol")
    for number, address in sorted(ctx.page_starts.items()):
        item = element("li")
        href = "../" + ctx.paths[address.target.chapter_id] + f"#page-{number}"
        item.append(element("a", {"href": href}, ctx.page_labels[number]))
        listing.append(item)
    return listing
