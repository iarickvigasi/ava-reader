"""Immutable, page-local source glyph identities paired with accepted codepoint offsets."""

from dataclasses import dataclass

from .observations import Glyph


@dataclass(frozen=True)
class MappedGlyph:
    line_id: str
    ordinal: int
    glyph: Glyph
    start: int
    end: int


@dataclass(frozen=True)
class GlyphMap:
    owner_id: str
    text: str
    glyphs: tuple[MappedGlyph, ...]
