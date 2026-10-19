"""Independent text/geometry observations for native aside font qualification controls."""

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.observations import Glyph, Graphic, NativeLine, PageObservation

TEXT = "A complete source sentence remains exact inside this native aside."


def box(x0=20, y0=10, x1=550, y1=160):
    return Box(coordinate_space="page_points_top_left", x0=x0, y0=y0, x1=x1, y1=y1)


def line(ident="line", parts=None, y=30):
    parts = parts or [(TEXT, "ArialMT")]
    glyphs = []
    x = 40
    for text, font in parts:
        for token in text.replace("e\u0301", "\0"):  # One glyph may map to multiple codepoints.
            token = "e\u0301" if token == "\0" else token
            glyphs.append(
                Glyph(text=token, font=font, size=11, visible=True, box=box(x, y, x + 4, y + 11))
            )
            x += 4
    return NativeLine(
        id=ident,
        text="".join(text for text, _ in parts),
        glyphs=glyphs,
        box=box(40, y, x, y + 11),
        style=Style(id=ident, family="serif", italic=True),  # Must not become aside authority.
    )


def page(lines, kind="vector"):
    return PageObservation(
        number=1,
        width_pt=600,
        height_pt=300,
        rotation=0,
        render_path="renders/page-0001.png",
        render_sha256="a" * 64,
        render_width=600,
        render_height=300,
        lines=lines,
        graphics=[Graphic(box=box(), kind=kind)],
        risks=[],
    )
