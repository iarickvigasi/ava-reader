"""Bounded render plus independent native geometry for a single source page."""

import hashlib
from pathlib import Path
from typing import Any, Literal, cast

from PIL import Image
from pypdf import PdfReader

from ..extract import render_page
from .embedded_image_capture import capture_image_assets
from .geometry import rectangle
from .native_lines import native_lines
from .native_paint import painted_chars
from .native_uri_underlines import native_uri_underline
from .observations import Graphic, PageObservation
from .observe_glyphs import observe_glyphs
from .source_list_bodies import source_list_bodies
from .visibility import display_risks


def observe_page(
    path: Path,
    reader: PdfReader,
    page: Any,
    number: int,
    scratch: Path,
    *,
    capture_paint: bool = False,
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
        paint_image = raw.convert("RGB") if capture_paint else None
    chars, filled_stroke_qualified = painted_chars(page) if capture_paint else (page.chars, False)
    source_page = reader.pages[number - 1]
    bodies = source_list_bodies(source_page, reader) if capture_paint else set()
    instances: dict[int, set[int | None]] = {}
    tags: dict[int, set[str | None]] = {}
    for char in chars:
        mcid = char.get("mcid")
        if char.get("native_tags_direct") is True and type(mcid) is int:
            instances.setdefault(mcid, set()).add(char.get("native_tag_instance"))
            tags.setdefault(mcid, set()).add(char.get("tag"))
    bodies &= {
        mcid
        for mcid, values in instances.items()
        if len(values) == 1 and None not in values and tags[mcid] == {"P"}
    }
    for char in chars:
        direct = char.get("native_tags_direct") is True
        mcid = char.get("mcid")
        char["source_artifact"] = direct and char.get("tag") == "Artifact"
        char["list_body_mcid"] = (
            mcid
            if direct and char.get("tag") == "P" and type(mcid) is int and mcid in bodies
            else None
        )
    glyphs, risks = observe_glyphs(chars, image, (left, top, right, bottom))
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
    risks += display_risks(
        source_page,
        reader,
        glyph_bounds=native_bounds,
        allow_filled_stroke=filled_stroke_qualified,
        allow_raster_settings=capture_paint,
    )
    names = {"/" + str(obj["name"]) for obj in page.images if obj.get("tag") == "Artifact"}
    assets = capture_image_assets(source_page, reader, scratch, names) if capture_paint else {}
    lines = native_lines(glyphs, number)
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
            asset = (
                assets.get((box.x0, box.y0, box.x1, box.y1))
                if kind == "image" and obj.get("tag") == "Artifact"
                else None
            )
            underline = (
                native_uri_underline(obj, box, lines, width, height, paint_image)
                if paint_image is not None
                and kind == "vector"
                and not set(risks) - {"language_uncertain"}
                else None
            )
            graphics.append(
                Graphic(
                    underline_line_id=underline,
                    box=box,
                    kind=cast(Literal["image", "vector"], kind),
                    source_image=asset,
                )
            )
    underlined = {g.underline_line_id for g in graphics if g.underline_line_id is not None}
    lines = [
        line.model_copy(update={"style": line.style.model_copy(update={"underline": True})})
        if line.id in underlined
        else line
        for line in lines
    ]
    return PageObservation(
        number=number,
        width_pt=width,
        height_pt=height,
        rotation=cast(Literal[0, 90, 180, 270], int(page.rotation) % 360),
        render_path=str(rendered.relative_to(scratch)),
        render_sha256=hashlib.sha256(rendered.read_bytes()).hexdigest(),
        render_width=image.width,
        render_height=image.height,
        lines=lines,
        graphics=graphics,
        risks=sorted(set(risks)),
    )
