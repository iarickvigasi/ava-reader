"""Authored source pixels and independent finite decisions; never used by runtime selection."""

import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan, Segment
from ava_pdf_epub.reconstruction_v2.source_feature_tasks import source_feature_tasks

BODY = "Ordinary source prose establishes this column and its regular body appearance. " * 2
QUOTE = '"A quoted passage has its own words.\nThey remain on the next authored line."\n- A visitor'


def case(scratch: Path, *, two_columns=False, include_quote=True, existing_tasks=0):
    source = scratch / "authored.pdf"
    image = Image.new("RGB", (1024, 1280), "white")
    draw, font = ImageDraw.Draw(image), ImageFont.load_default(size=20)
    rows = [
        ("heading", "2 Workshop guide", (40, 30, 230, 50)),
        ("quoted", QUOTE, (60, 90, 250, 150)),
        ("body", BODY, (40, 190, 240 if two_columns else 470, 240)),
        ("short", "A short distinct appearance", (40, 285, 175, 300)),
    ]
    if not include_quote:
        rows = [row for row in rows if row[0] != "quoted"]
    if two_columns:
        rows.append(("right-body", BODY, (290, 70, 490, 130)))
    segments = []
    for ident, text, coords in rows:
        if ident == "quoted":
            for n, line in enumerate(text.splitlines()):
                draw.text(
                    (coords[0] * 2 + (20 if n == 0 else 0), coords[1] * 2 + n * 23),
                    line,
                    font=font,
                    fill="black",
                )
        else:
            draw.multiline_text(
                (coords[0] * 2, coords[1] * 2),
                textwrap.fill(text, width=40 if two_columns else 80)
                if ident in {"body", "right-body"}
                else text,
                font=ImageFont.load_default(size=32) if ident == "heading" else font,
                fill="black",
                spacing=3,
            )
        kind = "heading" if ident == "heading" else "paragraph"
        segment = Segment(
            id=ident,
            page=1,
            kind=kind,
            method="ocr",
            text=text,
            box=Box(
                coordinate_space="page_points_top_left",
                x0=coords[0],
                y0=coords[1],
                x1=coords[2],
                y1=coords[3],
            ),
            style=Style(
                id="observed", bold=kind == "heading", relative_size=1.7 if kind == "heading" else 1
            ),
            heading_level=1 if kind == "heading" else None,
            chapter_start=kind == "heading",
            chapter_role="bodymatter" if kind == "heading" else None,
            spans=[ObservedSpan(start=0, end=2, style=Style(id="observed", italic=True))]
            if ident == "quoted"
            else [],
        )
        segments.append(segment)
    image.save(source, format="PDF", resolution=144)
    page = prepare_page(source, scratch, 1)
    state = AssemblyState()
    tasks = source_feature_tasks(source, scratch, [page], segments, state, existing_tasks)
    return source, page, segments, state, tasks
