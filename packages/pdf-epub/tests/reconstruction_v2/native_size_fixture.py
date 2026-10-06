"""Independent raw point sizes and stable role observations for document font-reference controls."""

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.geometry import union
from ava_pdf_epub.reconstruction_v2.observations import Glyph, NativeLine, PageObservation
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan, Segment

from .aside_font_fixture import box

TEXT = "A source paragraph has enough ordinary prose to form a measured line."


def segment(ident, page, size=12, kind="paragraph", count=2, y=20, **updates):
    rows = []
    for i in range(count):
        bounds = box(40, y + i * 20, 440, y + i * 20 + size)
        rows.append(
            NativeLine(
                id=f"{ident}-line{i}",
                text=TEXT,
                box=bounds,
                glyphs=[Glyph(text=TEXT, size=size, box=bounds, font="Times-Roman", visible=True)],
                style=Style(id=f"{ident}-line{i}", family="serif"),
            )
        )
    value = Segment(
        id=ident,
        page=page,
        box=union([r.box for r in rows]),
        text=" ".join(r.text for r in rows),
        source_text="\n".join(r.text for r in rows),
        native_line_ids=[r.id for r in rows],
        kind=kind,
        method="native",
        heading_level=1 if kind == "heading" else None,
        style=updates.get("style")
        or Style(
            id=ident,
            family="serif",
            bold=False,
            italic=False,
            align="start",
            relative_size=size / 10.5,
            indent_em=0,
        ),
        spans=[ObservedSpan(start=0, end=1, style=Style(id=ident + "-inline", relative_size=0.7))],
    )
    return value.model_copy(update=updates), rows


def document(items):
    segments = [s for s, _ in items]
    count = max(s.page for s in segments)
    prepared = []
    for number in range(1, count + 1):
        rows = [row for s, lines in items if s.page == number for row in lines]
        observation = PageObservation(
            number=number,
            width_pt=600,
            height_pt=800,
            rotation=0,
            render_path=f"renders/page-{number:04d}.png",
            render_sha256="a" * 64,
            render_width=600,
            render_height=800,
            lines=rows,
            graphics=[],
            risks=[],
        )
        prepared.append(
            PreparedPage(
                schema_version="ava-prepared-page-1",
                source_sha256="b" * 64,
                source_byte_length=1,
                source_page_count=count,
                observation=observation,
                tables=[],
                tasks=[],
                native_segments=[s for s in segments if s.page == number],
            )
        )
    return segments, prepared
