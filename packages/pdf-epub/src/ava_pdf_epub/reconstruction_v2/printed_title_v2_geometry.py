"""Deterministic readable panels share source-page context without source-text joins."""

import hashlib
import math
from typing import Literal

from ..contracts.source import Box
from .geometry import rectangle
from .printed_title_v2_contract import FrontmatterTitleNode, FrontmatterTitlePage

LABEL_HEIGHT = 32
LABEL_WIDTH = 360
GAP = 16
MAX_PANEL = 2048
MAX_SHEET = 4096

type TitlePiece = tuple[str, Literal["title", "context"], str | None, int, Box, str, list[int]]


def frontmatter_title_geometry(
    nodes: list[FrontmatterTitleNode], pages: list[FrontmatterTitlePage]
) -> tuple[list[TitlePiece], int, int]:
    panels: list[tuple[str, Literal["title", "context"], str | None, int, Box, str]] = []
    for node in nodes:
        b = node.box
        crop = rectangle(
            (b.x0 - 4, b.y0 - 4, b.x1 + 4, b.y1 + 4), node.page_width_pt, node.page_height_pt
        )
        key = hashlib.sha256(node.id.encode()).hexdigest()[:24]
        panels.append(("title-" + key, "title", node.id, node.page, crop, node.render_sha256))
    for page in pages:
        local = [n for n in nodes if n.page == page.page]
        top = 0 if page.page == 1 else max(0, min(n.box.y0 for n in local) - 100)
        bottom = (
            page.page_height_pt
            if page.page == 1
            else min(page.page_height_pt, max(n.box.y1 for n in local) + 220)
        )
        crop = rectangle(
            (0, top, page.page_width_pt, bottom), page.page_width_pt, page.page_height_pt
        )
        panels.append(
            (f"context-page{page.page}", "context", None, page.page, crop, page.render_sha256)
        )
    pieces: list[TitlePiece] = []
    x = y = row_height = width = 0
    for ident, part, node_id, number, box, digest in panels:
        w, h = math.ceil((box.x1 - box.x0) * 2), math.ceil((box.y1 - box.y0) * 2)
        if max(w, h) > MAX_PANEL:
            raise ValueError("Frontmatter title panel exceeds readable source bounds")
        slot_width = max(w, LABEL_WIDTH)
        if x and x + slot_width > MAX_SHEET:
            y += row_height + GAP
            x = row_height = 0
        if y + LABEL_HEIGHT + h > MAX_SHEET:
            raise ValueError("Frontmatter title sheet exceeds complete catalogue bounds")
        pixels = [x, y + LABEL_HEIGHT, x + w, y + LABEL_HEIGHT + h]
        pieces.append((ident, part, node_id, number, box, digest, pixels))
        width = max(width, x + slot_width)
        row_height = max(row_height, LABEL_HEIGHT + h)
        x += slot_width + GAP
    return pieces, width, y + row_height
