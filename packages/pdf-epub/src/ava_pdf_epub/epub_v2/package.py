"""OPF display metadata projects accepted claims; source claims remain in provenance."""

import xml.etree.ElementTree as ET

from .context import Context
from .metadata import metadata_element
from .paths import asset_path

OPF = "http://www.idpf.org/2007/opf"


def package_document(ctx: Context, entries: dict[str, bytes]) -> bytes:
    root = ET.Element(
        "package",
        {
            "xmlns": OPF,
            "version": "3.0",
            "unique-identifier": "book-id",
            "prefix": "ava: https://ava-reader.org/vocab/epub/",
        },
    )
    root.append(metadata_element(ctx.book))
    manifest = ET.SubElement(root, "manifest")
    file_ids = {}
    resources = {"EPUB/" + asset_path(r): r for r in ctx.book.resources}
    for index, path in enumerate(sorted(entries)):
        if not path.startswith("EPUB/"):
            continue
        media = "application/xhtml+xml" if path.endswith(".xhtml") else "text/css"
        if path.endswith(".json"):
            media = "application/json"
        if path.startswith("EPUB/assets/"):
            media = resources[path].media_type
        attrs = {"id": f"file-{index}", "href": path[5:], "media-type": media}
        if path == "EPUB/nav/nav.xhtml":
            attrs["properties"] = "nav"
        if path in resources and resources[path].id == ctx.book.cover_resource_id:
            attrs["properties"] = "cover-image"
        ET.SubElement(manifest, "item", attrs)
        file_ids[path[5:]] = attrs["id"]
    spine = ET.SubElement(root, "spine")
    for chapter in ctx.book.spine:
        ET.SubElement(spine, "itemref", {"idref": file_ids[ctx.paths[chapter]]})
    return bytes(ET.tostring(root, encoding="utf-8", xml_declaration=True))
