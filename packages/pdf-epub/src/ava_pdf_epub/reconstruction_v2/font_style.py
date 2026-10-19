"""Map observed font properties to bounded semantic roles without embedding print fonts."""

from collections import Counter
from statistics import median

from ..contracts.styles import Style
from .font_traits import FontTraits, font_traits
from .observations import Glyph


def font_style(glyphs: list[Glyph], ident: str) -> Style:
    meaningful = [g for g in glyphs if g.text.strip()] or glyphs
    font = Counter(g.font.lower() for g in meaningful).most_common(1)[0][0]
    dominant = font_traits(font)
    return Style(
        id=ident,
        family=dominant.family,
        bold=all(glyph_traits(g).bold for g in meaningful),
        italic=all(font_traits(g.font).italic for g in meaningful),
        small_caps=dominant.small_caps,
        vertical_align="baseline",
        relative_size=1.0,
        color=meaningful[0].paint_color
        if all(g.paint_color == meaningful[0].paint_color for g in meaningful)
        else None,
    )


def glyph_size(glyphs: list[Glyph]) -> float:
    return (
        median(g.size for g in glyphs if g.text.strip())
        if any(g.text.strip() for g in glyphs)
        else median(g.size for g in glyphs)
    )


def glyph_traits(glyph: Glyph) -> FontTraits:
    traits = font_traits(glyph.font)
    return traits._replace(bold=True) if glyph.paint_bold else traits
