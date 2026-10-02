"""Bounded render plus independent native geometry for a single source page."""

import hashlib
from pathlib import Path
from typing import Any, Literal, cast

from PIL import Image
from pypdf import PdfReader

from ..extract import render_page
from .geometry import rectangle
from .native_lines import native_lines
from .observations import Graphic, PageObservation
from .observe_glyphs import observe_glyphs
from .visibility import display_risks


def observe_page(
    path: Path, reader: PdfReader, page: Any, number: int, scratch: Path
) -> PageObservation:
    rendered = scratch / "renders" / f"page-{number:04d}.png"
    rendered.parent.mkdir(parents=True, exist_ok=True)
    render_page(path, number, rendered)
    bounds = tuple(float(v) for v in page.cropbox)
    if len(bounds) != 4:
        raise ValueError("Invalid CropBox")
    left, top, right, bottom = bounds
    width, height = right - left, bottom - top
    with Image.open(rendered) as raw:
        raw.load()
        image = raw.convert("L")
    glyphs, risks = observe_glyphs(page.chars, image, (left, top, right, bottom))
    source_page = reader.pages[number - 1]
    native_bounds = None
    crop = source_page.cropbox
    if (
        glyphs
        and source_page.rotation % 360 == 0
        and float(crop.left) == float(crop.bottom) == 0
        and list(crop) == list(source_page.mediabox)
    ):
        # Includes every observed glyph, not only those with visible ink. The
        # single clip must contain the whole source envelope, without tolerance.
        # Offset crops/rotation retain conservative review until independently
        # qualified in the PDF-to-native coordinate mapping.
        native_bounds = (
            float(crop.left) + min(g.box.x0 for g in glyphs),
            float(crop.top) - max(g.box.y1 for g in glyphs),
            float(crop.left) + max(g.box.x1 for g in glyphs),
            float(crop.top) - min(g.box.y0 for g in glyphs),
        )
    risks += display_risks(source_page, reader, glyph_bounds=native_bounds)
    graphics: list[Graphic] = []
    for kind, objects in [
        ("image", page.images),
        ("vector", page.curves + page.rects + page.lines),
    ]:
        if len(objects) > 10000:
            raise ValueError("Page graphic bound exceeded")
        for obj in objects:
            x0, y0, x1, y1 = (float(obj[k]) for k in ("x0", "top", "x1", "bottom"))
            if x1 <= left or x0 >= right or y1 <= top or y0 >= bottom:
                continue
            box = rectangle(
                (x0 - left, y0 - top, max(x1, x0 + 0.1) - left, max(y1, y0 + 0.1) - top),
                width,
                height,
            )
            graphics.append(Graphic(box=box, kind=cast(Literal["image", "vector"], kind)))
    return PageObservation(
        number=number,
        width_pt=width,
        height_pt=height,
        rotation=cast(Literal[0, 90, 180, 270], int(page.rotation) % 360),
        render_path=str(rendered.relative_to(scratch)),
        render_sha256=hashlib.sha256(rendered.read_bytes()).hexdigest(),
        render_width=image.width,
        render_height=image.height,
        lines=native_lines(glyphs, number),
        graphics=graphics,
        risks=sorted(set(risks)),
    )
