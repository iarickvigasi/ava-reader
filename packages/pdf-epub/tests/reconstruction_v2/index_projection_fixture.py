"""Authored full index with intentionally wrong estimated paragraph positions."""

from PIL import Image

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.geometry import union
from ava_pdf_epub.reconstruction_v2.index_layout import mark_index_layout
from ava_pdf_epub.reconstruction_v2.native_layout_policy import NATIVE_LAYOUT_POLICY
from ava_pdf_epub.reconstruction_v2.prepared_native_layout import NativeLayoutPreparedPage
from ava_pdf_epub.reconstruction_v2.route_native import route_native
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan, Segment

from .index_fixture import index_page
from .test_pdf_links import box


def projection_case(directory, *, fused=False):
    page = mark_index_layout(index_page(fused=fused))
    Image.new("RGB", (346, 582), "white").save(directory / page.render_path)
    _, tasks = route_native(page, [], [], "a" * 64, directory)
    checkpoint = NativeLayoutPreparedPage.model_validate(
        dict(
            schema_version="ava-prepared-page-2",
            source_layout_policy=NATIVE_LAYOUT_POLICY,
            profile_id=tasks[0].profile_id,
            source_sha256="a" * 64,
            source_byte_length=1,
            source_page_count=1,
            observation=page,
            tables=[],
            native_segments=[],
            native_line_maps=[],
            tasks=tasks,
        )
    )
    owners, expected = [], {}
    for column, term, base in [(0, "alpha", 10), (1, "omega", 20)]:
        for i in range(6):
            text = f"{term}{i} {base + i}"
            ident = f"page1-{tasks[0].task_id[10:22]}-{column * 6 + i}"
            # Every estimated box points at an unrelated empty part of the page.
            owners.append(
                Segment(
                    id=ident,
                    page=1,
                    method="ocr",
                    kind="paragraph",
                    text=text,
                    box=box(250, 250 + i * 12, 300, 260 + i * 12),
                    style=Style(id="plain", family="serif", indent_em=0),
                    spans=[ObservedSpan(start=0, end=1, style=Style(id="em", italic=True))],
                )
            )
            line = next(
                r
                for r in page.lines
                if r.id == f"{'left' if column == 0 else 'right'}{i}"
                or (fused and i == 2 and r.id == "fused")
            )
            glyphs = [
                g
                for g in line.glyphs
                if g.text.strip() and (g.box.x1 < 173 if column == 0 else g.box.x0 > 173)
            ]
            expected[ident] = union([g.box for g in glyphs])
    return checkpoint, owners, expected
