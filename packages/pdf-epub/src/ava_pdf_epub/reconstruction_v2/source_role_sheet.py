"""Full-page context is shared once, with complete local crops at two pixels per point."""

import base64
import hashlib
import io
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from ..contracts.private_files import snapshot
from .geometry import rectangle
from .prepared_types import AnyPreparedPage
from .recognition_contract import RecognitionImage
from .segments import Segment
from .source_role_contract import SourceRoleCrop

SLOT = 1024
LABEL = 32


def source_role_sheet(
    checkpoint: AnyPreparedPage, owners: list[Segment], scratch: Path
) -> tuple[list[SourceRoleCrop], RecognitionImage] | None:
    page = checkpoint.observation
    if (
        page.rotation
        or not owners
        or any(not s.box.within(page.width_pt, page.height_pt) for s in owners)
    ):
        return None
    full = rectangle((0, 0, page.width_pt, page.height_pt), page.width_pt, page.height_pt)
    boxes = [
        full,
        *[
            rectangle(
                (0, s.box.y0 - 16, page.width_pt, s.box.y1 + 16), page.width_pt, page.height_pt
            )
            for s in owners
        ],
    ]
    dims = [(math.ceil((b.x1 - b.x0) * 2), math.ceil((b.y1 - b.y0) * 2)) for b in boxes]
    height = max(dims[0][1] + LABEL, sum(h + LABEL for _, h in dims[1:]))
    if any(w > SLOT for w, _ in dims) or height > 2048:
        return None
    data = snapshot(scratch, page.render_path, 16 * 1024**2)
    if hashlib.sha256(data).hexdigest() != page.render_sha256:
        raise ValueError("Source role page render changed")
    slot = max(width for width, _ in dims)
    sheet = Image.new("RGB", (slot * 2, height), "white")
    draw, crops, y = ImageDraw.Draw(sheet), [], 0
    with Image.open(io.BytesIO(data)) as image:
        image.load()
        sx, sy = image.width / page.width_pt, image.height / page.height_pt
        for index, (box, (width, high)) in enumerate(zip(boxes, dims, strict=True)):
            ident = "role-page" if index == 0 else "role-local-" + str(index)
            label = ident if index == 0 else ident + " " + owners[index - 1].id
            x, top = (0, 0) if index == 0 else (slot, y)
            draw.text((x + 4, top + 4), label, fill="black", font=ImageFont.load_default(size=18))
            pixels = image.convert("RGB").crop(
                (
                    math.floor(box.x0 * sx),
                    math.floor(box.y0 * sy),
                    math.ceil(box.x1 * sx),
                    math.ceil(box.y1 * sy),
                )
            )
            sheet.paste(pixels.resize((width, high), Image.Resampling.LANCZOS), (x, top + LABEL))
            crops.append(
                SourceRoleCrop(
                    id=ident,
                    part="page" if index == 0 else "local",
                    node_id=None if index == 0 else owners[index - 1].id,
                    source_box=box,
                    render_sha256=page.render_sha256,
                    image_box=[x, top + LABEL, x + width, top + LABEL + high],
                )
            )
            if index:
                y += high + LABEL
    output = io.BytesIO()
    sheet.save(output, format="PNG")
    data = output.getvalue()
    if len(data) > 4 * 1024**2:
        return None
    return crops, RecognitionImage(
        media_type="image/png",
        width=sheet.width,
        height=sheet.height,
        byte_length=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        base64=base64.b64encode(data).decode(),
    )
