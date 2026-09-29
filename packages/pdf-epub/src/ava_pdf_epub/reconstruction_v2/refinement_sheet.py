"""Common physical scale source crops; labels occupy their own pixels outside each crop."""

import base64
import hashlib
import io
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .prepared import PreparedPage
from .recognition_contract import RecognitionImage
from .refinement_contract import RefinementCrop
from .refinement_sheet_bounds import (
    LABEL_HEIGHT,
    SLOT_WIDTH,
    crop_geometry,
    crop_parts,
    sheet_fits,
    sheet_row_heights,
)
from .segments import Segment


def refinement_sheet(
    ids: list[str],
    segments: dict[str, Segment],
    pages: dict[int, PreparedPage],
    scratch: Path,
    tail_ids: set[str] | None = None,
) -> tuple[list[RefinementCrop], RecognitionImage]:
    if not sheet_fits(ids, segments, pages, tail_ids):
        raise ValueError("Refinement contact sheet exceeds readable geometry limits")
    pieces = []
    for ident, part in crop_parts(ids, segments, tail_ids or set()):
        segment = segments[ident]
        page = pages[segment.page].observation
        crop_box, width, height = crop_geometry(segment, pages[segment.page], part)
        with Image.open(scratch / page.render_path) as opened:
            sx, sy = opened.width / page.width_pt, opened.height / page.height_pt
            crop = opened.convert("RGB").crop(
                (
                    math.floor(crop_box.x0 * sx),
                    math.floor(crop_box.y0 * sy),
                    math.ceil(crop_box.x1 * sx),
                    math.ceil(crop_box.y1 * sy),
                )
            )
            crop = crop.resize((width, height), Image.Resampling.LANCZOS)
        pieces.append((segment, page, crop_box, crop, part))
    heights = sheet_row_heights([piece[3].height for piece in pieces])
    total = sum(heights)
    if not pieces or len(pieces) > 48 or total > 2048 or SLOT_WIDTH * 2 * total > 20000000:
        raise ValueError("Refinement contact sheet exceeds limits")
    sheet = Image.new("RGB", (SLOT_WIDTH * 2, total), "white")
    draw, crops, y = ImageDraw.Draw(sheet), [], 0
    for index, (segment, page, box, pixels, part) in enumerate(pieces):
        x = (index % 2) * SLOT_WIDTH
        crop_id = ("crop-" if part == "head" else "tail-") + segment.id
        draw.text((x + 4, y + 4), crop_id, fill="black", font=ImageFont.load_default(size=18))
        sheet.paste(pixels, (x, y + LABEL_HEIGHT))
        crops.append(
            RefinementCrop(
                id=crop_id,
                part=part,
                node_id=segment.id,
                page=segment.page,
                source_box=box,
                render_sha256=page.render_sha256,
                image_box=[x, y + LABEL_HEIGHT, x + pixels.width, y + LABEL_HEIGHT + pixels.height],
            )
        )
        if index % 2:
            y += heights[index // 2]
    output = io.BytesIO()
    sheet.save(output, format="PNG")
    data = output.getvalue()
    if len(data) > 4 * 1024**2:
        raise ValueError("Refinement image byte limit exceeded")
    return crops, RecognitionImage(
        media_type="image/png",
        sha256=hashlib.sha256(data).hexdigest(),
        byte_length=len(data),
        width=sheet.width,
        height=sheet.height,
        base64=base64.b64encode(data).decode(),
    )
