"""Immutable, bounded font-name interpretation shared by glyph and line typography."""

from functools import lru_cache
from typing import Literal, NamedTuple


class FontTraits(NamedTuple):
    family: Literal["serif", "sans-serif", "monospace"] | None
    bold: bool
    italic: bool
    small_caps: bool


@lru_cache(maxsize=256)
def font_traits(name: str) -> FontTraits:
    font = name.lower()
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
    return FontTraits(
        family,
        any(s in font for s in ("bold", "black", "demi")),
        any(s in font for s in ("italic", "oblique"))
        or font.split("+")[-1] in {"minionpro-it", "minionpro-boldit"},
        any(s in font for s in ("smallcap", "small cap", "-sc")),
    )
