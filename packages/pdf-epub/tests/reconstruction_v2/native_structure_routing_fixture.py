"""Authored original PNG metadata distinguishes page bytes from legacy crop encoding."""

import hashlib
from pathlib import Path

from PIL import Image
from PIL.PngImagePlugin import PngInfo

from ava_pdf_epub.reconstruction_v2.make_task import make_task
from ava_pdf_epub.reconstruction_v2.native_line_offsets import (
    mapped_native_ids,
    native_line_offsets,
)
from ava_pdf_epub.reconstruction_v2.page_checkpoints import PageCheckpoints
from ava_pdf_epub.reconstruction_v2.prepared_native_layout import NativeLayoutPreparedPage

from .native_structure_decision_fixture import SOURCE, box, page


def checkpoint(
    scratch,
    lines,
    *,
    number=1,
    count=1,
    risks=(),
    graphics=(),
    tables=(),
    preserved=(),
    purpose="pdf_structure_repair",
    crop=None,
):
    renders = Path(scratch) / "renders"
    renders.mkdir(exist_ok=True)
    path = renders / f"p{number}.png"
    info = PngInfo()
    info.add_text("authored-original", "Metadata must survive exact page-image transport.")
    Image.new("RGB", (600, 800), "white").save(path, pnginfo=info)
    data = path.read_bytes()
    observation, _ = page(lines, graphics)
    observation = observation.model_copy(
        update={
            "number": number,
            "render_path": f"renders/p{number}.png",
            "render_sha256": hashlib.sha256(data).hexdigest(),
            "risks": list(risks),
        }
    )
    task = make_task(
        observation, SOURCE, crop or box(0, 0, 600, 800), Path(scratch), purpose=purpose
    )
    return NativeLayoutPreparedPage(
        schema_version="ava-prepared-page-2",
        source_layout_policy="ava-native-layout-1",
        source_sha256=SOURCE,
        source_byte_length=10000,
        source_page_count=count,
        observation=observation,
        tables=list(tables),
        native_segments=list(preserved),
        tasks=[task],
        native_line_maps=native_line_offsets(
            observation, list(preserved), mapped_native_ids(list(preserved))
        ),
    )


def stored(scratch, checkpoints):
    root = Path(scratch) / "pages"
    root.mkdir()
    pages = PageCheckpoints(root, "ava-native-layout-1")
    for checkpoint in checkpoints:
        pages.append(checkpoint)
    return pages
