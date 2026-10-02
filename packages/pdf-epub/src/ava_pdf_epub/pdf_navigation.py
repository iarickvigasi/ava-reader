"""Read PDF navigation as inert, bounded data. No action is ever executed."""

import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlsplit

from pypdf import PdfReader
from pypdf.generic import ArrayObject, Destination, Fit, NullObject

from .contracts.links import ExternalTarget
from .static_navigation import static_page_jump


@dataclass(frozen=True)
class NavigationTarget:
    url: str | None = None
    page: int | None = None  # One-based source page, distinct from printed folios.
    top: float | None = None
    left: float | None = None
    derived_scheme: bool = False


def navigation_uri(value: object, base: str | None = None) -> NavigationTarget:
    if not isinstance(value, str) or not value or len(value) > 2048:
        raise ValueError("PDF_LINK_TARGET_REQUIRES_REVIEW")
    if any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in value) or "\\" in value:
        raise ValueError("PDF_LINK_TARGET_REQUIRES_REVIEW")
    uri, derived = value, False
    if not urlsplit(uri).scheme:
        if base:
            ExternalTarget(kind="external", url=base)
            uri = urljoin(base, uri)
        elif re.fullmatch(r"www\.[A-Za-z0-9.-]+(?:[/?#][^\s]*)?", uri):
            uri, derived = "https://" + uri, True
        else:
            raise ValueError("PDF_LINK_TARGET_REQUIRES_REVIEW")
    checked = ExternalTarget(kind="external", url=uri)
    if derived:
        host = urlsplit(checked.url).hostname or ""
        labels = host.split(".")
        if len(labels) < 3 or any(
            not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?", label)
            for label in labels
        ):
            raise ValueError("PDF_LINK_TARGET_REQUIRES_REVIEW")
    return NavigationTarget(url=checked.url, derived_scheme=derived)


def pdf_navigation(reader: PdfReader, annotation: Any) -> NavigationTarget:
    if annotation.get("/Subtype") != "/Link" or "/AA" in annotation:
        raise ValueError("PDF_LINK_ACTION_REQUIRES_REVIEW")
    action = annotation.get("/A")
    if action is not None:
        action = action.get_object()
        if "/Next" in action:
            raise ValueError("PDF_LINK_ACTION_REQUIRES_REVIEW")
        kind = action.get("/S")
        if kind == "/URI":
            root = reader.trailer["/Root"]
            if not isinstance(root, dict):
                raise ValueError("PDF_LINK_TARGET_REQUIRES_REVIEW")
            catalog = root.get("/URI", {})
            if hasattr(catalog, "get_object"):
                catalog = catalog.get_object()
            if not isinstance(catalog, dict):
                raise ValueError("PDF_LINK_TARGET_REQUIRES_REVIEW")
            base = catalog.get("/Base")
            return navigation_uri(action.get("/URI"), base)
        if kind == "/JavaScript":
            script = action.get("/JS")
            # Exact text strings only; compressed executable streams are not admitted.
            return NavigationTarget(page=static_page_jump(script, len(reader.pages)) + 1)
        if kind != "/GoTo" or "/D" not in action:
            raise ValueError("PDF_LINK_ACTION_REQUIRES_REVIEW")
        raw = action["/D"]
    else:
        raw = annotation.get("/Dest")
    destination = raw.get_object() if hasattr(raw, "get_object") else raw
    if isinstance(destination, str):
        destination = reader.named_destinations.get(destination)
    elif isinstance(destination, ArrayObject) and 2 <= len(destination) <= 6:
        destination = Destination(
            "source-link", destination[0], Fit(str(destination[1]), destination[2:])
        )
    if not isinstance(destination, Destination):
        raise ValueError("PDF_LINK_TARGET_REQUIRES_REVIEW")
    index = reader.get_destination_page_number(destination)
    if index is None or not 0 <= index < len(reader.pages):
        raise ValueError("PDF_LINK_TARGET_REQUIRES_REVIEW")
    top, left = destination.top, destination.left
    return NavigationTarget(
        page=index + 1,
        top=float(top) if top is not None and not isinstance(top, NullObject) else None,
        left=float(left) if left is not None and not isinstance(left, NullObject) else None,
    )
