"""Current validated whole-page task with displaced OCR boxes and complete original TOC."""

import hashlib

from PIL import Image

from ava_pdf_epub.reconstruction_v2.geometry import union
from ava_pdf_epub.reconstruction_v2.make_task import make_task
from ava_pdf_epub.reconstruction_v2.prepared_native_layout import NativeLayoutPreparedPage

from .test_pdf_links import box, segment
from .toc_caller_fixture import fixture


def projection_case(directory, *, roman=False, merged=False):
    f = fixture(directory, roman=roman)
    page = f.page
    if merged:
        lines = list(page.lines)
        for title, folio in [(2, 3), (4, 5), (6, 7)]:
            a, b = lines[title], lines[folio]
            lines[title] = a.model_copy(
                update={
                    "text": a.text + " " + b.text,
                    "glyphs": [*a.glyphs, *b.glyphs],
                    "box": union([a.box, b.box]),
                }
            )
        page = page.model_copy(
            update={"lines": [line for i, line in enumerate(lines) if i not in {3, 5, 7}]}
        )
    Image.new("RGB", (120, 100), "white").save(directory / page.render_path)
    page = page.model_copy(
        update={
            "risks": ["native_spacing_unresolved"],
            "render_sha256": hashlib.sha256(
                (directory / page.render_path).read_bytes()
            ).hexdigest(),
        }
    )
    page = type(page).model_validate(page.model_dump())
    task = make_task(page, f.checkpoint.source_sha256, box(0, 0, 120, 100), directory)
    data = f.checkpoint.model_dump()
    data.update(
        schema_version="ava-prepared-page-2",
        source_layout_policy="ava-native-layout-1",
        observation=page,
        tasks=[task],
        native_line_maps=[],
    )
    f.checkpoint = NativeLayoutPreparedPage.model_validate(data)
    raw = [segment("header", "Contents").model_copy(update={"kind": "heading"}), *f.owners]
    f.owners = [
        s.model_copy(
            update={
                "id": f"page1-{task.task_id[10:22]}-{i}",
                "box": box(0, 90, 10, 99),
            }
        )
        for i, s in enumerate(raw)
    ]
    return f
