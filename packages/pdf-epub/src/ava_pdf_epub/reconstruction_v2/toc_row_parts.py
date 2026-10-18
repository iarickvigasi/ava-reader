"""Partition a complete row into its body and source-proven terminal folio glyphs."""

from .ocr_glyph_fragments import Fragment
from .toc_folio_tail import TocFolio, toc_folio_tail


def toc_row_parts(fragments: list[Fragment], label: str) -> tuple[list[Fragment], TocFolio] | None:
    if not fragments:
        return None
    line, selected = fragments[-1]
    folio = toc_folio_tail(line, label)
    if folio is None:
        return None
    tail = list(folio.glyphs)
    if selected[-len(tail) :] != tail:
        return None
    body = [(item, list(values)) for item, values in fragments[:-1]]
    prefix = selected[: -len(tail)]
    if prefix:
        body.append((line, prefix))
    return (body, folio) if body else None
