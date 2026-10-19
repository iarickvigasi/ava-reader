"""A folio is an exact terminal slice of an original line, never fabricated provenance."""

from dataclasses import dataclass

from ..contracts.source import Box
from .geometry import union
from .native_line_visibility import complete_visible_line
from .observations import Glyph, NativeLine
from .ocr_glyph_stream import single_stream


@dataclass(frozen=True)
class TocFolio:
    line: NativeLine
    glyphs: tuple[tuple[int, Glyph], ...]
    box: Box

    @property
    def id(self) -> str:
        return self.line.id


def toc_folio_tail(line: NativeLine, label: str) -> TocFolio | None:
    text = line.text.rstrip()
    prefix = text[: -len(label)] if label else ""
    if (
        not label
        or not text.endswith(label)
        or (prefix and not prefix[-1].isspace())
        or not complete_visible_line(line)
    ):
        return None
    selected: list[tuple[int, Glyph]] = []
    suffix = ""
    for ordinal in range(len(line.glyphs) - 1, -1, -1):
        glyph = line.glyphs[ordinal]
        if not glyph.text.strip():
            continue
        suffix = glyph.text + suffix
        selected.insert(0, (ordinal, glyph))
        if not label.endswith(suffix):
            return None
        if suffix == label:
            break
    if suffix != label or not single_stream([(line, selected)]):
        return None
    return TocFolio(line, tuple(selected), union([g.box for _, g in selected]))
