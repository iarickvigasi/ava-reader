"""Only complete source-owned index rows can supply physical-column indentation."""

from itertools import groupby
from math import isfinite
from statistics import median

from .index_entry_source import source_index_entry
from .index_indent_types import IndexIndentGeometry
from .index_layout import index_rows
from .index_projection_types import IndexSourceRow
from .observations import PageObservation
from .ocr_glyph_map import prove_glyph_map
from .ocr_glyph_types import GlyphMap
from .segments import Segment


def index_indent_geometry(
    page: PageObservation,
    owner: Segment,
    owners: list[Segment],
    policy: str | None,
    proof: GlyphMap | None = None,
    source_rows: tuple[IndexSourceRow, ...] = (),
) -> IndexIndentGeometry | None:
    proof = proof or prove_glyph_map(page, owner, owners, policy)
    if proof is None or not source_index_entry(page, owner, proof, source_rows):
        return None
    fragments = [list(values) for _, values in groupby(proof.glyphs, key=lambda g: g.line_id)]
    size = median(item.glyph.size for item in proof.glyphs)
    font = fragments[0][0].glyph.font.strip()
    if (
        font.casefold() in {"", "unknown", "none", "null", "/unknown"}
        or size <= 0
        or any(abs(item.glyph.size - size) > size * 0.02 for item in proof.glyphs)
    ):
        return None
    margins = tuple(min(item.glyph.box.x0 for item in fragment) for fragment in fragments)
    column = 1 if max(g.glyph.box.x1 for g in fragments[0]) < page.width_pt / 2 else 2
    return IndexIndentGeometry(owner, column, size, margins, font)


def index_column_origin(
    entry: IndexIndentGeometry, entries: list[IndexIndentGeometry], page: PageObservation
) -> float | None:
    peers = [item for item in entries if item.column == entry.column]
    # The accepted subset cannot move the source column boundary to a subentry.
    source = [
        glyph.box.x0
        for row in index_rows(page)
        for glyph in row.glyphs
        if glyph.visible
        and glyph.text.strip()
        and (
            glyph.box.x1 < page.width_pt / 2
            if entry.column == 1
            else glyph.box.x0 > page.width_pt / 2
        )
    ]
    if not source:
        return None
    left = min(source)
    tolerance = entry.size * 0.05
    aligned = [
        item
        for item in peers
        if abs(item.margins[0] - left) <= tolerance
        and abs(item.size - entry.size) <= entry.size * 0.02
        and item.font == entry.font
        and item.owner.style is not None
        and item.owner.style.indent_em == 0
        and item.owner.style.block_indent_em in {None, 0}
    ]
    differentiated = any(max(item.margins) - left > entry.size * 0.25 for item in peers)
    if len(aligned) < 3 or not differentiated:
        return None
    return median(item.margins[0] for item in aligned)


def measured_index_indents(entry: IndexIndentGeometry, origin: float) -> dict[str, float] | None:
    first, *continuations = entry.margins
    body = median(continuations) if continuations else first
    if any(abs(margin - body) > entry.size * 0.05 for margin in continuations):
        return None
    values = {
        "indent_em": (first - body) / entry.size,
        "block_indent_em": (body - origin) / entry.size,
    }
    # A source-aligned root has a physical tolerance, not rounded contract bounds.
    values = {key: 0.0 if abs(value) <= 0.05 else value for key, value in values.items()}
    if not all(isfinite(value) for value in values.values()) or (
        not -3 <= values["indent_em"] <= 6 or not 0 <= values["block_indent_em"] <= 6
    ):
        return None
    return values
