"""Independent local package/link/text checks; these do not replace EPUBCheck or reading QA."""

from __future__ import annotations

import posixpath
import xml.etree.ElementTree as ET
from collections import Counter
from collections.abc import Mapping
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import unquote, urlsplit

from .inline import EPUB, XHTML, is_external_candidate, safe_external_href

OPF = "http://www.idpf.org/2007/opf"


def validate_resources(
    resources: Mapping[str, bytes],
    expected_text: Mapping[str, str] | None = None,
    expected_pages: int | None = None,
) -> dict[str, Any]:
    """Validate bytes intended for this generated archive, without resolving external entities."""
    findings: list[dict[str, str]] = []

    def fail(code: str, message: str) -> None:
        findings.append({"code": code, "message": message})

    trees: dict[str, ET.Element] = {}
    ids: dict[str, set[str]] = {}
    for path, data in resources.items():
        if not _safe_archive_path(path):
            fail("unsafe_archive_path", path)
        if not path.endswith((".xhtml", ".opf", ".xml")):
            continue
        if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
            fail("xml_declaration_forbidden", path)
            continue
        try:
            tree = ET.fromstring(data)
        except ET.ParseError as exc:
            fail("invalid_xml", f"{path}: {exc}")
            continue
        trees[path] = tree
        found = [node.attrib["id"] for node in tree.iter() if "id" in node.attrib]
        if len(found) != len(set(found)):
            fail("duplicate_id", path)
        ids[path] = set(found)
        for node in tree.iter():
            tag = node.tag.split("}")[-1]
            if tag in {"script", "iframe", "object", "embed", "form", "base"}:
                fail("active_content", f"{path}: {tag}")
            if any(key.lower().startswith("on") for key in node.attrib):
                fail("event_handler", path)

    link_count = 0
    external_count = 0
    for path, tree in trees.items():
        for node in tree.iter():
            for attribute in ("href", "src"):
                value = node.get(attribute)
                if value is None:
                    continue
                link_count += 1
                if is_external_candidate(value):
                    if (
                        attribute == "href"
                        and node.tag == f"{{{XHTML}}}a"
                        and safe_external_href(value)
                    ):
                        external_count += 1
                        continue
                    fail("unsafe_external_resource", f"{path}: {value}")
                    continue
                target = resolve_internal(path, value)
                if target is None:
                    fail("invalid_internal_uri", f"{path}: {value}")
                    continue
                resource, fragment = target
                if resource not in resources:
                    fail("missing_resource", f"{path}: {value}")
                elif fragment and fragment not in ids.get(resource, set()):
                    fail("missing_fragment", f"{path}: {value}")

    actual: dict[str, str] = {}
    occurrences: Counter[str] = Counter()
    page_ids: list[str] = []
    for path, tree in trees.items():
        if not path.endswith(".xhtml"):
            continue
        for node in tree.iter():
            block_id = node.get("data-canonical")
            if block_id is not None:
                occurrences[block_id] += 1
                actual[block_id] = "".join(node.itertext())
            if node.get(f"{{{EPUB}}}type") == "pagebreak":
                page_ids.append(node.get("id", ""))
    if expected_text is not None:
        if set(actual) != set(expected_text):
            fail("block_coverage", "Generated canonical block IDs differ from accepted blocks")
        for block_id, expected in expected_text.items():
            if occurrences[block_id] != 1:
                fail("block_occurrence", f"{block_id}: expected exactly one occurrence")
            if actual.get(block_id) != expected:
                fail("text_changed", block_id)
    if expected_pages is not None:
        if sorted(page_ids) != sorted(f"page-{n}" for n in range(1, expected_pages + 1)):
            fail("source_page_coverage", "Every physical page needs one unique source anchor")

    package = trees.get("EPUB/package.opf")
    spine_count = 0
    if package is None:
        fail("missing_package", "EPUB/package.opf")
    else:
        manifest = package.find(f"{{{OPF}}}manifest")
        spine = package.find(f"{{{OPF}}}spine")
        items = list(manifest) if manifest is not None else []
        item_by_id = {item.get("id"): item for item in items}
        if len(item_by_id) != len(items):
            fail("manifest_duplicate_id", "Manifest identifiers must be unique")
        nav_items = [item for item in items if "nav" in item.get("properties", "").split()]
        if len(nav_items) != 1:
            fail("navigation_manifest", "Exactly one navigation document is required")
        spine_items = list(spine) if spine is not None else []
        spine_count = len(spine_items)
        if not spine_items:
            fail("empty_spine", "No reading resources")
        seen_spine: set[str] = set()
        for itemref in spine_items:
            idref = itemref.get("idref", "")
            if idref not in item_by_id:
                fail("missing_spine_item", idref)
            elif item_by_id[idref].get("media-type") != "application/xhtml+xml":
                fail("spine_media_type", idref)
            if idref in seen_spine:
                fail("repeated_spine_item", idref)
            seen_spine.add(idref)

    return {
        "passed": not findings,
        "errors": findings,
        "checked_xml_resources": len(trees),
        "checked_links": link_count,
        "external_hyperlinks": external_count,
        "canonical_blocks": len(actual),
        "source_page_anchors": len(page_ids),
        "spine_resources": spine_count,
        "scope": "Local structure, paths, links, exact accepted text and block/page coverage only",
        "epubcheck": "not_run",
        "visual_review": "not_run",
        "ava_reader": "not_run",
    }


def _safe_archive_path(path: str) -> bool:
    return (
        bool(path)
        and not path.startswith("/")
        and "\\" not in path
        and ":" not in path
        and all(part not in {".", "..", ""} for part in path.split("/"))
    )


def resolve_internal(source: str, value: str) -> tuple[str, str] | None:
    try:
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc or parsed.query:
            return None
        path, fragment = unquote(parsed.path), unquote(parsed.fragment)
        if "\\" in path or path.startswith("/") or any(ord(c) < 32 for c in value):
            return None
        target = (
            posixpath.normpath(posixpath.join(posixpath.dirname(source), path)) if path else source
        )
        if target.startswith("../") or target == ".." or not _safe_archive_path(target):
            return None
        # Generated EPUB links never address sibling META-INF files or escape EPUB/.
        if PurePosixPath(source).parts[0] == "EPUB" and not target.startswith("EPUB/"):
            return None
        return target, fragment
    except ValueError:
        return None
