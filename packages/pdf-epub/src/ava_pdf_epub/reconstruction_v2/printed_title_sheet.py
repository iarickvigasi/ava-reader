"""One readable opening-page comparison, reusing the original verified page render."""

import base64
import hashlib
import io
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .prepared import PreparedPage
from .printed_title_contract import PrintedTitleCrop, PrintedTitleNode
from .printed_title_geometry import LABEL_HEIGHT, title_geometry
from .recognition_contract import RecognitionImage


def printed_title_sheet(
    node: PrintedTitleNode, prepared: PreparedPage, scratch: Path
) -> tuple[list[PrintedTitleCrop], RecognitionImage]:
    page = prepared.observation
    pieces, width, height = title_geometry(node)
    if max(width, height) > 2048:
        raise ValueError("Printed title comparison exceeds readable source bounds")
    source = scratch / page.render_path
    if hashlib.sha256(source.read_bytes()).hexdigest() != page.render_sha256:
        raise ValueError("Printed title original page render is stale")
    sheet = Image.new("RGB", (width, height), "white")
    draw, crops = ImageDraw.Draw(sheet), []
    with Image.open(source) as opened:
        if opened.size != (page.render_width, page.render_height):
            raise ValueError("Printed title original render dimensions differ")
        sx, sy = opened.width / page.width_pt, opened.height / page.height_pt
        for ident, part, box, pixels in pieces:
            x0, y0, x1, y1 = pixels
            bitmap = opened.convert("RGB").crop(
                (
                    math.floor(box.x0 * sx),
                    math.floor(box.y0 * sy),
                    math.ceil(box.x1 * sx),
                    math.ceil(box.y1 * sy),
                )
            )
            bitmap = bitmap.resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS)
            draw.text(
                (4, y0 - LABEL_HEIGHT + 4),
                ident,
                fill="black",
                font=ImageFont.load_default(size=18),
            )
            sheet.paste(bitmap, (x0, y0))
            crops.append(
                PrintedTitleCrop(
                    id=ident,
                    part=part,
                    node_id=node.id,
                    page=1,
                    source_box=box,
                    render_sha256=page.render_sha256,
                    image_box=pixels,
                )
            )
    output = io.BytesIO()
    sheet.save(output, format="PNG")
    data = output.getvalue()
    if len(data) > 4 * 1024**2:
        raise ValueError("Printed title image byte bound exceeded")
    return crops, RecognitionImage(
        media_type="image/png",
        sha256=hashlib.sha256(data).hexdigest(),
        byte_length=len(data),
        width=width,
        height=height,
        base64=base64.b64encode(data).decode(),
    )
