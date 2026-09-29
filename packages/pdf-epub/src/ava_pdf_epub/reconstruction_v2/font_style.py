"""Map observed font properties to bounded semantic roles without embedding print fonts."""

from collections import Counter
from statistics import median
from typing import Literal

from ..contracts.styles import Style
from .observations import Glyph


def font_style(glyphs: list[Glyph], ident: str) -> Style:
    meaningful = [g for g in glyphs if g.text.strip()] or glyphs
    font = Counter(g.font.lower() for g in meaningful).most_common(1)[0][0]
    family: Literal["serif", "sans-serif", "monospace"] | None = (
        "monospace"
        if any(s in font for s in ("mono", "courier", "consolas", "typewriter"))
        else "sans-serif"
        if any(s in font for s in ("sans", "arial", "helvetica", "calibri", "verdana"))
        else "serif"
        if any(
            s in font
            for s in (
                "serif",
                "times",
                "georgia",
                "cambria",
                "garamond",
                "baskerville",
                "palatino",
                "caslon",
                "minion",
                "charter",
                "roman",
            )
        )
        else None
    )
    return Style(
        id=ident,
        family=family,
        bold=all(any(s in g.font.lower() for s in ("bold", "black", "demi")) for g in meaningful),
        italic=all(any(s in g.font.lower() for s in ("italic", "oblique")) for g in meaningful),
        small_caps=any(s in font for s in ("smallcap", "small cap", "-sc")),
        vertical_align="baseline",
        relative_size=1.0,
    )


def glyph_size(glyphs: list[Glyph]) -> float:
    return (
        median(g.size for g in glyphs if g.text.strip())
        if any(g.text.strip() for g in glyphs)
        else median(g.size for g in glyphs)
    )
