"""TOC nesting and exact chapter/block/offset links, plus first source-page occurrences."""

import xml.etree.ElementTree as ET

from ..contracts.profiles import BILINGUAL_PROFILE, package_language
from .context import Context
from .xml import EPUB, document, element


def navigation(ctx: Context) -> bytes:
    body = element("body")
    nav = element("nav", {f"{{{EPUB}}}type": "toc", "id": "toc"})
    nav.append(element("h1", text="Contents"))
    root = element("ol")
    nav.append(root)
    items: dict[str, ET.Element] = {}
    children: dict[str, ET.Element] = {}
    for entry in ctx.book.toc:
        parent = root
        if entry.parent_id is not None:
            if entry.parent_id not in children:
                children[entry.parent_id] = element("ol")
                items[entry.parent_id].append(children[entry.parent_id])
            parent = children[entry.parent_id]
        item = element("li")
        item.append(element("a", {"href": ctx.href(entry.target)}, entry.label))
        parent.append(item)
        items[entry.id] = item
    body.append(nav)
    pages = element("nav", {f"{{{EPUB}}}type": "page-list"})
    pages.append(element("h2", text="Source pages"))
    listing = element("ol")
    seen = set()
    for block in ctx.book.blocks:
        for evidence in block.evidence:
            if evidence.page not in seen:
                item = element("li")
                href = "../" + ctx.paths[ctx.owners[block.id]] + f"#page-{evidence.page}"
                item.append(element("a", {"href": href}, str(evidence.page)))
                listing.append(item)
                seen.add(evidence.page)
    pages.append(listing)
    body.append(pages)
    return document(
        "Contents",
        body,
        package_language(ctx.book) if ctx.book.profile_id == BILINGUAL_PROFILE else "en",
    )
