"""Authored dense source appearances exercise whole-book capacity without mocking task factories."""

from PIL import Image, ImageDraw, ImageFont

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.segments import Segment

BODY = "Ordinary source prose establishes the reading column and preserves all its complete words."


def feature_book(scratch, count=27, *, title=True, current=True):
    source = scratch / "source.pdf"
    image = Image.new("RGB", (1024, 1500), "white")
    draw, font = ImageDraw.Draw(image), ImageFont.load_default(size=12)
    segments = []
    rows = [("title", "A Source Book", 40, 20, 250, 38, "heading")] if title else []
    for i in range(count):
        y = 60 + i * 24
        rows.extend(
            [
                (f"quote{i}", f"A source quotation number {i}.", 60, y, 450, y + 8, "paragraph"),
                (f"body{i}", BODY, 40, y + 11, 470, y + 19, "paragraph"),
            ]
        )
    for ident, text, left, top, right, bottom, kind in rows:
        draw.text((left * 2, top * 2), text, fill="black", font=font)
        segments.append(
            Segment(
                id=ident,
                page=1,
                kind=kind,
                method="ocr",
                text=text,
                box=Box(
                    coordinate_space="page_points_top_left", x0=left, y0=top, x1=right, y1=bottom
                ),
                style=Style(id="observed", bold=kind == "heading", relative_size=1),
                heading_level=1 if kind == "heading" else None,
                chapter_start=kind == "heading",
                chapter_role="frontmatter" if kind == "heading" else None,
            )
        )
    image.save(source, format="PDF", resolution=144)
    page = prepare_page(source, scratch, 1, "ava-pdf-prose-en-uk-v3")
    state = AssemblyState()
    if current:
        state.source_title_policy = "ava-frontmatter-title-1"
        state.source_continuation_policy = "ava-source-continuation-presentation-1"
    return source, [page], segments, state
