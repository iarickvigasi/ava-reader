"""Validate the new task independently without broadening historical refinement authority."""

import base64
import hashlib
import io
from typing import TYPE_CHECKING

from PIL import Image

from ..contracts.common import text_digest
from .printed_title_geometry import title_geometry
from .refinement_identity import refinement_identifier

if TYPE_CHECKING:
    from .printed_title_contract import PrintedTitleTask


def validate_printed_title_task(task: "PrintedTitleTask") -> None:
    node = task.node
    if task.task_id != refinement_identifier(task.model_dump(mode="json")):
        raise ValueError("Printed title task identity differs")
    if text_digest(node.text) != node.text_sha256:
        raise ValueError("Printed title immutable whole-heading text differs")
    if not (
        0 <= node.box.x0 < node.box.x1 <= node.page_width_pt
        and 0 <= node.box.y0 < node.box.y1 <= node.page_height_pt
    ):
        raise ValueError("Printed title is outside its source page")
    expected, width, height = title_geometry(node)
    if max(width, height) > 2048 or (task.image.width, task.image.height) != (width, height):
        raise ValueError("Printed title image dimensions differ or exceed bounds")
    if len({crop.id for crop in task.crops}) != 2:
        raise ValueError("Printed title crops are repeated")
    for crop, (ident, part, source_box, image_box) in zip(task.crops, expected, strict=True):
        if (
            crop.id,
            crop.part,
            crop.node_id,
            crop.page,
            crop.render_sha256,
            crop.source_box,
            crop.image_box,
        ) != (ident, part, node.id, node.page, node.render_sha256, source_box, image_box):
            raise ValueError("Printed title requires its own exact heading/context geometry")
    data = base64.b64decode(task.image.base64, validate=True)
    if (
        len(data) > 4 * 1024**2
        or len(data) != task.image.byte_length
        or hashlib.sha256(data).hexdigest() != task.image.sha256
    ):
        raise ValueError("Printed title image identity differs")
    with Image.open(io.BytesIO(data)) as opened:
        opened.verify()
    with Image.open(io.BytesIO(data)) as opened:
        if (
            opened.format != "PNG"
            or opened.size != (width, height)
            or getattr(opened, "n_frames", 1) != 1
            or opened.getexif().get(274, 1) != 1
        ):
            raise ValueError("Printed title image must be one upright source PNG")
        opened.load()
