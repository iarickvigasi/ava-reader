"""Serialize canonical text and bounded, typed spans without trusting model HTML."""

from __future__ import annotations

import posixpath
import re
import xml.etree.ElementTree as ET
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from urllib.parse import unquote, urlsplit

from .models import Block

XHTML = "http://www.w3.org/1999/xhtml"
EPUB = "http://www.idpf.org/2007/ops"
XML = "http://www.w3.org/XML/1998/namespace"


def xhtml(tag: str) -> str:
    return f"{{{XHTML}}}{tag}"


def xml_id(kind: str, value: str) -> str:
    """Injective IDs in separate namespaces; source IDs never become archive paths."""
    return f"{kind}-{value.encode('utf-8').hex()}"


@dataclass(frozen=True)
class Address:
    resource: str
    fragment: str


def relative_href(source: str, address: Address) -> str:
    path = posixpath.relpath(address.resource, posixpath.dirname(source))
    if path == posixpath.basename(source):
        return f"#{address.fragment}"
    return f"{path}#{address.fragment}"


def safe_external_href(value: str) -> bool:
    """External user-activated links only; never fetch or allow active/file schemes."""
    if any(ord(char) < 33 or char == "\\" for char in value):
        return False
    decoded = unquote(value)
    if any(ord(char) < 32 or char == "\\" for char in decoded):
        return False
    try:
        parsed = urlsplit(value)
        if parsed.scheme == "https":
            return bool(parsed.hostname) and not parsed.username and not parsed.password
        if parsed.scheme == "mailto":
            return bool(parsed.path) and "@" in parsed.path and not parsed.netloc
    except ValueError:
        return False
    return False


def is_external_candidate(value: str) -> bool:
    return bool(re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", value)) or value.startswith("//")


def append_text(parent: ET.Element, value: str) -> None:
    if len(parent):
        parent[-1].tail = (parent[-1].tail or "") + value
    else:
        parent.text = (parent.text or "") + value


def emit_spans(
    parent: ET.Element,
    block: Block,
    links: Mapping[int, tuple[str, str | None]],
    page_markers: Mapping[int, list[dict[str, str]]] | None = None,
) -> None:
    """Crossing style ranges are segmented; link ranges remain one anchor each.

    `links` is already resolved and validated by the assembler. Unknown/unsafe
    links are omitted from markup while their exact canonical characters survive.
    """
    link_spans = sorted(
        ((i, span) for i, span in enumerate(block.spans) if span.kind in {"link", "noteref"}),
        key=lambda item: (item[1].start, item[1].end, item[0]),
    )
    markers = page_markers or {}
    emitted: set[int] = set()

    def emit_markers(at: int, into: ET.Element) -> None:
        if at not in emitted:
            for attrs in markers.get(at, []):
                ET.SubElement(into, xhtml("span"), attrs)
            emitted.add(at)

    def emit_range(into: ET.Element, start: int, end: int) -> None:
        _emit_style_range(into, block, start, end, set(markers), emit_markers)

    cursor = 0
    for index, span in link_spans:
        emit_range(parent, cursor, span.start)
        resolved = links.get(index)
        if resolved:
            href, reference_id = resolved
            attrs = {"href": href}
            if span.kind == "noteref":
                attrs[f"{{{EPUB}}}type"] = "noteref"
                attrs["role"] = "doc-noteref"
                attrs["class"] = "noteref"
            if reference_id:
                attrs["id"] = reference_id
            anchor = ET.SubElement(parent, xhtml("a"), attrs)
            emit_range(anchor, span.start, span.end)
        else:
            emit_range(parent, span.start, span.end)
        cursor = span.end
    emit_range(parent, cursor, len(block.text))


def _emit_style_range(
    parent: ET.Element,
    block: Block,
    start: int,
    end: int,
    marker_offsets: set[int],
    emit_markers: Callable[[int, ET.Element], None],
) -> None:
    if start == end:
        emit_markers(start, parent)
        return
    styles = [s for s in block.spans if s.kind not in {"link", "noteref"}]
    boundaries = sorted(
        {start, end}
        | {v for s in styles for v in (s.start, s.end) if start < v < end}
        | {offset for offset in marker_offsets if start < offset < end}
    )
    # A fixed nesting order makes overlapping visual spans deterministic and valid XML.
    priority = {"strong": 0, "em": 1, "smallcaps": 2, "sup": 3, "sub": 4}
    for left, right in zip(boundaries, boundaries[1:], strict=False):
        emit_markers(left, parent)
        active = {s.kind for s in styles if s.start <= left and s.end >= right}
        element = parent
        for kind in sorted(active, key=lambda item: priority[item]):
            if kind == "smallcaps":
                element = ET.SubElement(element, xhtml("span"), {"class": "smallcaps"})
            else:
                element = ET.SubElement(element, xhtml(kind))
        append_text(element, block.text[left:right])
    emit_markers(end, parent)


IssueRecorder = Callable[[str, str, str | None], None]


def resolve_span_links(
    block: Block,
    resource: str,
    addresses: Mapping[str, Address],
    blocks: Mapping[str, Block],
    record: IssueRecorder,
) -> tuple[dict[int, tuple[str, str | None]], dict[str, list[Address]]]:
    links: dict[int, tuple[str, str | None]] = {}
    backlinks: dict[str, list[Address]] = {}
    for index, span in enumerate(block.spans):
        target = span.target
        if target is None:
            continue
        if span.kind == "link" and is_external_candidate(target):
            if safe_external_href(target):
                links[index] = (target, None)
            else:
                record("unsafe_external_link", "Rejected external link scheme or URI", block.id)
            continue
        address = addresses.get(target)
        if address is None:
            record("unresolved_link", f"Unknown target {target!r}", block.id)
            continue
        if span.kind == "noteref":
            if blocks[target].kind != "note":
                record(
                    "noteref_target_not_note", "Note reference targets non-note content", block.id
                )
                continue
            reference_id = f"{xml_id('ref', block.id)}-{index}"
            links[index] = (relative_href(resource, address), reference_id)
            backlinks.setdefault(target, []).append(Address(resource, reference_id))
        else:
            links[index] = (relative_href(resource, address), None)
    return links, backlinks
