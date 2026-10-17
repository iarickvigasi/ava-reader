"""Authored source-line/pixel coordinates, independent of the geometry recovery routine."""

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.observations import Glyph, NativeLine, PageObservation
from ava_pdf_epub.reconstruction_v2.segments import Segment


def line(ident, left, top):
    box = Box(coordinate_space="page_points_top_left", x0=left, x1=left + 130, y0=top, y1=top + 10)
    return NativeLine(
        id=ident,
        text="A source line has an authored margin",
        box=box,
        style=Style(id=ident),
        glyphs=[Glyph(text="A", box=box, font="Times-Roman", size=10, visible=True)],
    )


def segment(ident, rows, style=None, method="native"):
    return Segment(
        id=ident,
        page=1,
        kind="paragraph",
        method=method,
        native_line_ids=[r.id for r in rows] if method == "native" else [],
        box=Box(
            coordinate_space="page_points_top_left",
            x0=min(r.box.x0 for r in rows),
            x1=max(r.box.x1 for r in rows),
            y0=rows[0].box.y0,
            y1=rows[-1].box.y1,
        ),
        text="A source line begins without ending then another line continues",
        style=style or Style(id=ident, bold=False, italic=False),
    )


def page(rows, path="render.png", digest="a" * 64, width=400, height=300):
    return PageObservation(
        number=1,
        width_pt=width,
        height_pt=height,
        rotation=0,
        render_path=path,
        render_sha256=digest,
        render_width=width,
        render_height=height,
        lines=rows,
        graphics=[],
        risks=[],
    )
