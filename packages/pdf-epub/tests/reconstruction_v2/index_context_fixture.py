"""Source-owned accepted-entry controls, not a model transcription or book qualification."""

from PIL import Image

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.index_layout import mark_index_layout
from ava_pdf_epub.reconstruction_v2.native_layout_policy import NATIVE_LAYOUT_POLICY
from ava_pdf_epub.reconstruction_v2.prepared_native_layout import NativeLayoutPreparedPage
from ava_pdf_epub.reconstruction_v2.route_native import route_native
from ava_pdf_epub.reconstruction_v2.segments import Segment

from .index_fixture import index_page


def context_case(directory):
    page = mark_index_layout(index_page(introduction=True))
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
    segments = [
        Segment(
            id=f"page1-{tasks[0].task_id[10:22]}-{i}",
            page=1,
            method="ocr",
            kind="paragraph",
            text=row.text,
            box=row.box,
            style=Style(id="plain", family="serif", indent_em=0),
        )
        for i, row in enumerate(page.lines[1:])
    ]
    return checkpoint, segments
