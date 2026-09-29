"""Deterministic EPUB 3 assembly from accepted, source-linked book records.

This layer never calls a model or fetches resources. Structurally valid exports
may still have review issues; neither result implies a faithful edition or AVA readiness.
"""

from __future__ import annotations

import copy
import hashlib
import io
import json
import os
import posixpath
import re
import tempfile
import warnings
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any

from PIL import Image

from .inline import (
    EPUB,
    XHTML,
    XML,
    Address,
    emit_spans,
    relative_href,
    resolve_span_links,
    xhtml,
    xml_id,
)
from .models import Asset, Block, Book, Chapter, Claim, Issue
from .styles import compile_styles
from .validation import OPF, validate_resources

DC = "http://purl.org/dc/elements/1.1/"
CONTAINER = "urn:oasis:names:tc:opendocument:xmlns:container"
ASSEMBLER_VERSION = "ava-epub-1"
MAX_ASSET_BYTES = 64 * 1024 * 1024
MAX_ASSET_PIXELS = 40_000_000

ET.register_namespace("", XHTML)
ET.register_namespace("epub", EPUB)
ET.register_namespace("dc", DC)
ET.register_namespace("opf", OPF)


@dataclass
class Section:
    resource: str
    title: str
    kind: str
    blocks: list[Block]
    chapter: Chapter | None = None


def _serialize(root: ET.Element) -> bytes:
    # XML parsers otherwise normalize literal CR / CRLF, altering accepted text.
    serialized: bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return serialized.replace(b"\r", b"&#13;")


def _serialize_default_namespace(root: ET.Element, namespace: str) -> bytes:
    """Conventional OPF/container serialization supports namespace-naive consumers too."""
    copied = copy.deepcopy(root)
    prefix = f"{{{namespace}}}"
    for node in copied.iter():
        if node.tag.startswith(prefix):
            node.tag = node.tag[len(prefix) :]
    copied.set("xmlns", namespace)
    return _serialize(copied)


def _html_document(title: str, language: str, stylesheet: str) -> tuple[ET.Element, ET.Element]:
    root = ET.Element(xhtml("html"), {"lang": language, f"{{{XML}}}lang": language})
    head = ET.SubElement(root, xhtml("head"))
    ET.SubElement(head, xhtml("title")).text = title
    ET.SubElement(head, xhtml("meta"), {"charset": "utf-8"})
    ET.SubElement(head, xhtml("link"), {"rel": "stylesheet", "href": stylesheet})
    return root, ET.SubElement(root, xhtml("body"))


def _ensure_xml_characters(value: Any) -> None:
    """XML 1.0 applies to metadata/alt/labels as well as canonical source text."""
    if isinstance(value, str):
        for char in value:
            code = ord(char)
            if not (
                code in {9, 10, 13}
                or 0x20 <= code <= 0xD7FF
                or 0xE000 <= code <= 0xFFFD
                or 0x10000 <= code <= 0x10FFFF
            ):
                raise ValueError("Invalid XML character in book record")
    elif isinstance(value, dict):
        for nested in value.values():
            _ensure_xml_characters(nested)
    elif isinstance(value, list):
        for nested in value:
            _ensure_xml_characters(nested)


def _partition(book: Book) -> tuple[list[Section], dict[str, Address]]:
    # A preceding parent is insufficient: reopening a closed subtree would make
    # the nested TOC's traversal disagree with the actual spine order.
    open_ancestors: list[str] = []
    for chapter in book.chapters:
        if chapter.parent_id:
            if chapter.parent_id not in open_ancestors:
                raise ValueError("Chapter hierarchy is not contiguous in reading order")
            open_ancestors = open_ancestors[: open_ancestors.index(chapter.parent_id) + 1]
        else:
            open_ancestors = []
        open_ancestors.append(chapter.id)
    blocks = [block for page in book.pages for block in page.blocks]
    positions = {block.id: i for i, block in enumerate(blocks)}
    boundaries = [positions[chapter.start_block_id] for chapter in book.chapters]
    sections: list[Section] = []
    if boundaries[0] > 0:
        sections.append(
            Section(
                "EPUB/text/frontmatter.xhtml",
                "Front matter",
                "frontmatter",
                blocks[: boundaries[0]],
            )
        )
    for index, chapter in enumerate(book.chapters):
        stop = boundaries[index + 1] if index + 1 < len(boundaries) else len(blocks)
        sections.append(
            Section(
                f"EPUB/text/chapter-{index + 1:04d}.xhtml",
                chapter.title,
                chapter.kind,
                blocks[boundaries[index] : stop],
                chapter,
            )
        )
    addresses = {
        block.id: Address(section.resource, xml_id("b", block.id))
        for section in sections
        for block in section.blocks
    }
    return sections, addresses


def _read_asset(asset: Asset, asset_root: Path) -> bytes:
    path = PurePosixPath(asset.path)
    if (
        path.is_absolute()
        or "\\" in asset.path
        or ":" in asset.path
        or any(part in {"", ".", ".."} for part in asset.path.split("/"))
    ):
        raise ValueError(f"Unsafe asset path for {asset.id}")
    root = asset_root.resolve(strict=True)
    candidate = (root / asset.path).resolve(strict=True)
    if not candidate.is_relative_to(root) or not candidate.is_file():
        raise ValueError(f"Asset escapes root for {asset.id}")
    if candidate.stat().st_size > MAX_ASSET_BYTES:
        raise ValueError(f"Asset exceeds byte limit for {asset.id}")
    data = candidate.read_bytes()
    if len(data) > MAX_ASSET_BYTES or hashlib.sha256(data).hexdigest() != asset.sha256:
        raise ValueError(f"Asset checksum/size mismatch for {asset.id}")
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(data), formats=["PNG", "JPEG"]) as image:
            expected_format = {"image/png": "PNG", "image/jpeg": "JPEG"}[asset.media_type]
            if image.format != expected_format or image.size != (asset.width, asset.height):
                raise ValueError(f"Asset media type/dimensions mismatch for {asset.id}")
            if image.width * image.height > MAX_ASSET_PIXELS:
                raise ValueError(f"Asset exceeds pixel limit for {asset.id}")
            if getattr(image, "n_frames", 1) != 1:
                raise ValueError(f"Animated asset requires a separate policy for {asset.id}")
            image.verify()
        with Image.open(io.BytesIO(data), formats=["PNG", "JPEG"]) as image:
            image.load()  # verify JPEG decoding, not only container signatures
    return data


def _metadata(book: Book, record: Any) -> dict[str, Any]:
    accepted = [claim for claim in book.metadata if claim.status == "accepted"]
    for claim in book.metadata:
        if claim.status == "conflict":
            record("metadata_conflict", f"Unresolved metadata claim: {claim.field}", None)

    def one(field: str, fallback: str, scope: str | None = None) -> str:
        values = list(
            dict.fromkeys(
                c.value
                for c in accepted
                if c.field == field and (scope is None or c.scope == scope)
            )
        )
        if len(values) > 1:
            record("metadata_ambiguous", f"Multiple accepted values for {field}", None)
        if not values:
            record("metadata_fallback", f"No accepted {field}; using labeled fallback", None)
            return fallback
        return values[0]

    title = one("title", "Untitled converted book")
    language = one("language", "und")
    modified = one("modified", "1970-01-01T00:00:00Z", "conversion")
    if not re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", modified):
        raise ValueError("Conversion modified claim must be a UTC timestamp with seconds")
    datetime.strptime(modified, "%Y-%m-%dT%H:%M:%SZ")
    fields: dict[str, list[Claim]] = defaultdict(list)
    for claim in accepted:
        fields[claim.field].append(claim)
    return {
        "title": title,
        "language": language,
        "modified": modified,
        "accepted": accepted,
        "fields": fields,
    }


def _page_anchors(
    book: Book, addresses: dict[str, Address]
) -> tuple[dict[str, list[Any]], dict[str, dict[int, list[Any]]], list[Any]]:
    by_block: dict[str, list[Any]] = defaultdict(list)
    inline: dict[str, dict[int, list[Any]]] = defaultdict(lambda: defaultdict(list))
    pages: list[Any] = []
    all_blocks = [b for p in book.pages for b in p.blocks]
    explicit: dict[int, tuple[Block, int]] = {}
    for block in all_blocks:
        for marker in block.page_breaks:
            if marker.page in explicit:
                raise ValueError("More than one explicit source page boundary")
            explicit[marker.page] = (block, marker.offset)
    for index, page in enumerate(book.pages):
        candidates = (
            [explicit[page.number][0]]
            if page.number in explicit
            else [block for block in page.blocks if block.kind != "note"] or page.blocks
        )
        if not candidates:
            candidates = [b for p in book.pages[index + 1 :] for b in p.blocks][:1]
        if not candidates:
            candidates = all_blocks[-1:]
        anchor = Address(addresses[candidates[0].id].resource, f"page-{page.number}")
        item = {
            "number": page.number,
            "label": page.label or str(page.number),
            "address": anchor,
            "blank": not page.blocks,
        }
        if page.number in explicit:
            inline[candidates[0].id][explicit[page.number][1]].append(item)
        else:
            by_block[candidates[0].id].append(item)
        pages.append(item)
    return by_block, inline, pages


def _marker_attributes(page: dict[str, Any]) -> dict[str, str]:
    return {
        "id": page["address"].fragment,
        "class": "pagebreak",
        f"{{{EPUB}}}type": "pagebreak",
        "role": "doc-pagebreak",
        "aria-label": page["label"],
        "title": page["label"],
    }


def _emit_block(
    parent: ET.Element,
    block: Block,
    style_class: str,
    address: Address,
    links: dict[int, tuple[str, str | None]],
    assets: dict[str, Asset],
    asset_paths: dict[str, str],
    first: bool,
    page_markers: dict[int, list[dict[str, str]]] | None = None,
) -> ET.Element:
    attrs = {"id": address.fragment, "class": f"{block.kind} {style_class}"}
    if block.kind == "heading":
        node = ET.SubElement(parent, xhtml(f"h{block.level}"), attrs)
    elif block.kind == "quote":
        node = ET.SubElement(parent, xhtml("blockquote"), attrs)
    elif block.kind in {"verse", "code"}:
        node = ET.SubElement(parent, xhtml("pre" if block.kind == "code" else "p"), attrs)
    elif block.kind == "list_item":
        if "\n" in block.text:
            attrs["class"] += " multiline-list"
        node = ET.SubElement(parent, xhtml("li"), attrs)
    elif block.kind == "figure":
        node = ET.SubElement(parent, xhtml("figure"), attrs)
        assert block.asset_id is not None
        asset = assets[block.asset_id]
        image_attrs = {
            "src": posixpath.relpath(asset_paths[asset.id], posixpath.dirname(address.resource)),
            "alt": "" if asset.decorative else asset.alt,
            "width": str(asset.width),
            "height": str(asset.height),
        }
        if asset.decorative:
            image_attrs["role"] = "presentation"
        ET.SubElement(node, xhtml("img"), image_attrs)
        node = ET.SubElement(node, xhtml("figcaption"))
    elif block.kind == "separator":
        node = ET.SubElement(parent, xhtml("div"), attrs)
        ET.SubElement(node, xhtml("hr"))
        node = ET.SubElement(node, xhtml("span"))
    elif block.kind == "note":
        attrs[f"{{{EPUB}}}type"] = "footnote"
        # doc-footnote and epub:type together permit reading systems to expose a note.
        attrs["role"] = "doc-footnote"
        node = ET.SubElement(parent, xhtml("aside"), attrs)
        if block.label:
            ET.SubElement(node, xhtml("span"), {"class": "note-label"}).text = block.label + " "
        node = ET.SubElement(node, xhtml("p"))
    else:
        attrs["class"] = f"body {style_class}" + (" first" if first else "")
        node = ET.SubElement(parent, xhtml("p"), attrs)
    node.set("data-canonical", block.id)
    emit_spans(node, block, links, page_markers)
    return node


def _navigation(
    sections: list[Section],
    addresses: dict[str, Address],
    pages: list[Any],
    title: str,
    language: str,
    has_cover: bool,
) -> bytes:
    resource = "EPUB/nav.xhtml"
    root, body = _html_document(f"Contents — {title}", language, "styles/book.css")
    toc = ET.SubElement(body, xhtml("nav"), {f"{{{EPUB}}}type": "toc", "id": "toc"})
    ET.SubElement(toc, xhtml("h1")).text = "Contents"
    top = ET.SubElement(toc, xhtml("ol"))
    parent_items: dict[str, ET.Element] = {}
    child_lists: dict[str, ET.Element] = {}
    for section in sections:
        chapter = section.chapter
        parent = top
        if chapter and chapter.parent_id:
            if chapter.parent_id not in child_lists:
                child_lists[chapter.parent_id] = ET.SubElement(
                    parent_items[chapter.parent_id], xhtml("ol")
                )
            parent = child_lists[chapter.parent_id]
        item = ET.SubElement(parent, xhtml("li"))
        target = addresses[section.blocks[0].id]
        ET.SubElement(
            item, xhtml("a"), {"href": relative_href(resource, target)}
        ).text = section.title
        if chapter:
            parent_items[chapter.id] = item
    landmarks = ET.SubElement(
        body, xhtml("nav"), {f"{{{EPUB}}}type": "landmarks", "hidden": "hidden", "id": "landmarks"}
    )
    ET.SubElement(landmarks, xhtml("h2")).text = "Landmarks"
    landmark_list = ET.SubElement(landmarks, xhtml("ol"))
    if has_cover:
        item = ET.SubElement(landmark_list, xhtml("li"))
        ET.SubElement(
            item, xhtml("a"), {"href": "cover.xhtml", f"{{{EPUB}}}type": "cover"}
        ).text = "Cover"
    for kind in ("frontmatter", "bodymatter", "backmatter"):
        landmark_section = next((s for s in sections if s.kind == kind), None)
        if landmark_section:
            item = ET.SubElement(landmark_list, xhtml("li"))
            ET.SubElement(
                item,
                xhtml("a"),
                {
                    "href": relative_href(resource, addresses[landmark_section.blocks[0].id]),
                    f"{{{EPUB}}}type": kind,
                },
            ).text = landmark_section.title
    page_nav = ET.SubElement(
        body, xhtml("nav"), {f"{{{EPUB}}}type": "page-list", "hidden": "hidden", "id": "page-list"}
    )
    ET.SubElement(page_nav, xhtml("h2")).text = "Source pages"
    page_list = ET.SubElement(page_nav, xhtml("ol"))
    for page in pages:
        item = ET.SubElement(page_list, xhtml("li"))
        ET.SubElement(
            item,
            xhtml("a"),
            {
                "href": relative_href(resource, page["address"]),
            },
        ).text = page["label"]
    return _serialize(root)


def _package_document(
    book: Book,
    sections: list[Section],
    metadata: dict[str, Any],
    book_hash: str,
    media: dict[str, str],
    asset_paths: dict[str, str],
) -> bytes:
    root = ET.Element(
        f"{{{OPF}}}package", {"version": "3.0", "unique-identifier": "publication-id"}
    )
    values = ET.SubElement(root, f"{{{OPF}}}metadata")
    ET.SubElement(
        values, f"{{{DC}}}identifier", {"id": "publication-id"}
    ).text = f"urn:sha256:{book_hash}"
    ET.SubElement(values, f"{{{DC}}}title", {"id": "main-title"}).text = metadata["title"]
    ET.SubElement(values, f"{{{DC}}}language").text = metadata["language"]
    ET.SubElement(values, f"{{{OPF}}}meta", {"property": "dcterms:modified"}).text = metadata[
        "modified"
    ]
    ET.SubElement(values, f"{{{OPF}}}meta", {"property": "rendition:layout"}).text = "reflowable"
    fields = metadata["fields"]
    for index, claim in enumerate(fields.get("subtitle", [])):
        ident = f"subtitle-{index}"
        ET.SubElement(values, f"{{{DC}}}title", {"id": ident}).text = claim.value
        ET.SubElement(
            values, f"{{{OPF}}}meta", {"refines": f"#{ident}", "property": "title-type"}
        ).text = "subtitle"
    roles = {
        "author": "aut",
        "creator": "aut",
        "translator": "trl",
        "editor": "edt",
        "illustrator": "ill",
        "contributor": None,
    }
    index = 0
    for field, role in roles.items():
        for claim in fields.get(field, []):
            tag = "creator" if field in {"author", "creator"} else "contributor"
            ident = f"contributor-{index}"
            index += 1
            ET.SubElement(values, f"{{{DC}}}{tag}", {"id": ident}).text = claim.value
            if role:
                ET.SubElement(
                    values,
                    f"{{{OPF}}}meta",
                    {
                        "refines": f"#{ident}",
                        "property": "role",
                        "scheme": "marc:relators",
                    },
                ).text = role
    for field in ("description", "subject", "rights"):
        for claim in fields.get(field, []):
            ET.SubElement(values, f"{{{DC}}}{field}").text = claim.value
    # The source publisher/date/ISBN are bibliographic provenance, not assertions
    # that this locally generated EPUB is that publisher's issued ebook edition.
    source_fields = {
        "title",
        "subtitle",
        "author",
        "creator",
        "publisher",
        "imprint",
        "publication_place",
        "edition",
        "edition_statement",
        "printing",
        "year",
        "publication_year",
        "original_year",
        "translation_year",
        "reprint_year",
        "edition_first_published",
        "first_published",
        "reprint",
        "publication_date",
        "isbn",
        "isbn_10",
        "isbn_13",
        "identifier",
        "doi",
        "series",
        "volume",
    }
    citation = [
        f"{claim.field.replace('_', ' ')}: {claim.value}"
        for claim in metadata["accepted"]
        if claim.scope == "source_edition" and claim.field in source_fields
    ]
    ET.SubElement(values, f"{{{DC}}}source", {"id": "source-edition"}).text = (
        "; ".join(citation) or "Source PDF"
    ) + f"; SHA-256: {book.source_sha256}"
    for claim in fields.get("publisher", []):
        if claim.scope == "conversion":
            ET.SubElement(values, f"{{{DC}}}publisher").text = claim.value
    manifest = ET.SubElement(root, f"{{{OPF}}}manifest")
    manifest_ids: dict[str, str] = {}
    for index, path in enumerate(sorted(media)):
        ident = f"resource-{index:04d}"
        manifest_ids[path] = ident
        attrs = {"id": ident, "href": posixpath.relpath(path, "EPUB"), "media-type": media[path]}
        if path == "EPUB/nav.xhtml":
            attrs["properties"] = "nav"
        if book.cover_asset_id and path == asset_paths[book.cover_asset_id]:
            attrs["properties"] = "cover-image"
        ET.SubElement(manifest, f"{{{OPF}}}item", attrs)
    spine = ET.SubElement(root, f"{{{OPF}}}spine")
    if book.cover_asset_id:
        ET.SubElement(spine, f"{{{OPF}}}itemref", {"idref": manifest_ids["EPUB/cover.xhtml"]})
    for section in sections:
        ET.SubElement(spine, f"{{{OPF}}}itemref", {"idref": manifest_ids[section.resource]})
    return _serialize_default_namespace(root, OPF)


def _write_archive(resources: dict[str, bytes], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        prefix=f".{output.name}.", suffix=".tmp", dir=output.parent, delete=False
    ) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with zipfile.ZipFile(temporary_path, "w") as archive:
            for path in ["mimetype", *sorted(name for name in resources if name != "mimetype")]:
                info = zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                info.compress_type = (
                    zipfile.ZIP_STORED if path == "mimetype" else zipfile.ZIP_DEFLATED
                )
                archive.writestr(info, resources[path], compresslevel=9)
        os.replace(temporary_path, output)
    finally:
        temporary_path.unlink(missing_ok=True)


def build_epub(book: Book, asset_root: Path, output: Path) -> dict[str, Any]:
    """Build an inspectable EPUB; return package validity separately from review findings.

    Invalid schema/assets/unsafe XML fail closed before replacing any output. Missing
    link targets keep their exact source text with an explicit issue and no broken href.
    """
    # Revalidate because BaseModel.model_copy(update=...) bypasses Pydantic validators.
    book = Book.model_validate_json(book.model_dump_json())
    _ensure_xml_characters(book.model_dump(mode="json"))
    issues = [issue.model_dump() for issue in book.issues]
    issues += [issue.model_dump() for page in book.pages for issue in page.issues]

    def record(code: str, message: str, block_id: str | None = None) -> None:
        issues.append(Issue(code=code, message=message, block_id=block_id).model_dump())

    metadata = _metadata(book, record)
    sections, addresses = _partition(book)
    blocks = {block.id: block for page in book.pages for block in page.blocks}
    inline_represented_pages = {
        marker.page for block in blocks.values() for marker in block.page_breaks
    }
    for chapter in book.chapters:
        if not chapter.verified:
            record(
                "chapter_unverified",
                f"Chapter boundary not source-verified: {chapter.id}",
                chapter.start_block_id,
            )
    for page in book.pages:
        if page.route == "needs_ocr":
            record("page_needs_ocr", f"Source page {page.number} still needs recognition")
        if (
            not page.blocks
            and page.route != "blank"
            and page.number not in inline_represented_pages
        ):
            record("empty_unverified_page", f"Source page {page.number} has no accepted content")
    for block in blocks.values():
        if block.continues_from_previous or block.continues_to_next:
            record(
                "unresolved_continuation",
                "Assembler preserves fragments; join requires evidence",
                block.id,
            )
    assets = {asset.id: asset for asset in book.assets}
    resources: dict[str, bytes] = {"mimetype": b"application/epub+zip"}
    media: dict[str, str] = {
        "EPUB/nav.xhtml": "application/xhtml+xml",
        "EPUB/styles/book.css": "text/css",
    }
    asset_paths: dict[str, str] = {}
    for asset in book.assets:
        data = _read_asset(asset, asset_root)
        ext = "png" if asset.media_type == "image/png" else "jpg"
        path = f"EPUB/images/{asset.sha256}.{ext}"
        resources[path] = data
        media[path] = asset.media_type
        asset_paths[asset.id] = path
        if not asset.alt.strip() and not asset.decorative:
            record("asset_alt_missing", f"Non-decorative asset has no alternative text: {asset.id}")
    css, style_classes = compile_styles(block.style for block in blocks.values())
    resources["EPUB/styles/book.css"] = css.encode()
    link_map: dict[str, dict[int, tuple[str, str | None]]] = {}
    backlinks: dict[str, list[Address]] = defaultdict(list)
    for block in blocks.values():
        links, returns = resolve_span_links(
            block, addresses[block.id].resource, addresses, blocks, record
        )
        link_map[block.id] = links
        for target, refs in returns.items():
            backlinks[target].extend(refs)
    for block in blocks.values():
        if block.kind == "note" and not backlinks[block.id]:
            record(
                "note_without_callout",
                "Note preserved but no explicit source callout is resolved",
                block.id,
            )
    by_block, inline_pages, pages = _page_anchors(book, addresses)

    def emit_page_markers(parent: ET.Element, block: Block) -> None:
        for page in by_block.get(block.id, []):
            ET.SubElement(parent, xhtml("span"), _marker_attributes(page))

    def inline_marker_attributes(block: Block) -> dict[int, list[dict[str, str]]]:
        return {
            offset: [_marker_attributes(page) for page in markers]
            for offset, markers in inline_pages.get(block.id, {}).items()
        }

    for section in sections:
        root, body = _html_document(section.title, metadata["language"], "../styles/book.css")
        wrapper = ET.SubElement(
            body,
            xhtml("section"),
            {
                f"{{{EPUB}}}type": "chapter" if section.kind == "bodymatter" else section.kind,
                "aria-label": section.title,
            },
        )
        list_parent: ET.Element | None = None
        first_paragraph = True
        for block in section.blocks:
            if block.kind == "note":
                continue
            emit_page_markers(wrapper, block)
            parent = wrapper
            if block.kind == "list_item":
                if list_parent is None:
                    list_parent = ET.SubElement(wrapper, xhtml("ul"))
                parent = list_parent
            else:
                list_parent = None
            _emit_block(
                parent,
                block,
                style_classes[block.style.model_dump_json()],
                addresses[block.id],
                link_map[block.id],
                assets,
                asset_paths,
                first_paragraph,
                inline_marker_attributes(block),
            )
            if block.kind == "paragraph":
                first_paragraph = False
        notes = [block for block in section.blocks if block.kind == "note"]
        if notes:
            note_section = ET.SubElement(
                wrapper, xhtml("section"), {"class": "notes", "aria-label": "Notes"}
            )
            for block in notes:
                emit_page_markers(note_section, block)
                _emit_block(
                    note_section,
                    block,
                    style_classes[block.style.model_dump_json()],
                    addresses[block.id],
                    link_map[block.id],
                    assets,
                    asset_paths,
                    False,
                    inline_marker_attributes(block),
                )
                if backlinks[block.id]:
                    container = ET.SubElement(
                        note_section[-1], xhtml("span"), {"class": "backlinks"}
                    )
                    for index, ref in enumerate(backlinks[block.id]):
                        ET.SubElement(
                            container,
                            xhtml("a"),
                            {
                                "href": relative_href(section.resource, ref),
                                "role": "doc-backlink",
                                "aria-label": f"Return to reference {index + 1}",
                            },
                        ).text = "↩" if len(backlinks[block.id]) == 1 else f"↩{index + 1} "
        resources[section.resource] = _serialize(root)
        media[section.resource] = "application/xhtml+xml"

    if book.cover_asset_id:
        asset = assets[book.cover_asset_id]
        root, body = _html_document(
            f"Cover — {metadata['title']}", metadata["language"], "styles/book.css"
        )
        body.set("class", "cover")
        body.set(f"{{{EPUB}}}type", "cover")
        ET.SubElement(
            body,
            xhtml("img"),
            {
                "src": posixpath.relpath(asset_paths[asset.id], "EPUB"),
                "alt": asset.alt or f"Cover of {metadata['title']}",
                "width": str(asset.width),
                "height": str(asset.height),
            },
        )
        resources["EPUB/cover.xhtml"] = _serialize(root)
        media["EPUB/cover.xhtml"] = "application/xhtml+xml"
    resources["EPUB/nav.xhtml"] = _navigation(
        sections,
        addresses,
        pages,
        metadata["title"],
        metadata["language"],
        bool(book.cover_asset_id),
    )
    frozen = json.dumps(
        book.model_dump(mode="json"), ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()
    book_hash = hashlib.sha256(ASSEMBLER_VERSION.encode() + b"\0" + frozen).hexdigest()
    resources["EPUB/package.opf"] = _package_document(
        book, sections, metadata, book_hash, media, asset_paths
    )
    container = ET.Element(f"{{{CONTAINER}}}container", {"version": "1.0"})
    roots = ET.SubElement(container, f"{{{CONTAINER}}}rootfiles")
    ET.SubElement(
        roots,
        f"{{{CONTAINER}}}rootfile",
        {"full-path": "EPUB/package.opf", "media-type": "application/oebps-package+xml"},
    )
    resources["META-INF/container.xml"] = _serialize_default_namespace(container, CONTAINER)
    validation = validate_resources(
        resources, {key: block.text for key, block in blocks.items()}, book.page_count
    )
    if not validation["passed"]:
        return {"export_valid": False, "output": None, "issues": issues, "validation": validation}
    _write_archive(resources, output)
    return {
        "export_valid": True,
        "output": str(output),
        "epub_sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "book_revision_sha256": book_hash,
        "assembler_version": ASSEMBLER_VERSION,
        "issues": issues,
        "validation": validation,
        "content_files": [section.resource for section in sections],
        "counts": {
            "blocks": len(blocks),
            "chapters": len(book.chapters),
            "source_pages": book.page_count,
            "assets": len(assets),
            "notes": sum(block.kind == "note" for block in blocks.values()),
            "resolved_note_references": sum(len(refs) for refs in backlinks.values()),
        },
        "metadata": {
            "title": metadata["title"],
            "language": metadata["language"],
            "modified": metadata["modified"],
            "generated_identifier": f"urn:sha256:{book_hash}",
            "accepted_claims": [claim.model_dump() for claim in metadata["accepted"]],
        },
        "source_mapping": {
            block_id: {"resource": address.resource, "fragment": address.fragment}
            for block_id, address in addresses.items()
        },
        "policies": {
            "notes": "at_end_of_source_section",
            "style": "typed_source_over_editorial_defaults",
            "source_text": "exact canonical block text; generated labels excluded",
            "archive": "frozen timestamp and ordered entries; same frozen input is reproducible",
        },
    }
