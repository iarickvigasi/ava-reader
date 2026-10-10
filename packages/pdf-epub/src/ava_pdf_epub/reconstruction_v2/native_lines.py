"""Group visible glyphs geometrically; never concatenate the PDF content-stream order."""

from statistics import median

from .font_style import font_style
from .geometry import union
from .observations import Glyph, NativeLine


def native_lines(glyphs: list[Glyph], page: int) -> list[NativeLine]:
    if not glyphs or not any(g.text.strip() for g in glyphs):
        return []
    body = median(g.size for g in glyphs if g.text.strip())
    from .glyph_rows import glyph_rows

    parts = glyph_rows(glyphs, body)
    return [_line(part, page, index) for index, part in enumerate(parts) if part]


def _line(glyphs: list[Glyph], page: int, index: int) -> NativeLine:
    text = ""
    previous = None
    for glyph in glyphs:
        if previous and glyph.box.x0 - previous.box.x1 > min(glyph.size, previous.size) * 0.18:
            if not text.endswith((" ", "\t")) and not glyph.text.startswith((" ", "\t")):
                text += " "
        text += glyph.text
        previous = glyph
    ident = f"p{page}-line{index}"
    return NativeLine(
        id=ident,
        box=union([g.box for g in glyphs]),
        text=text,
        glyphs=glyphs,
        style=font_style(glyphs, ident + "-style"),
    )
