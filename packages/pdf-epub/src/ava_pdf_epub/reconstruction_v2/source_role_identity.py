"""Each decision sees the whole source page and its unchanged complete local owner."""

import base64
import hashlib
import io
import math
from typing import TYPE_CHECKING

from PIL import Image

from ..contracts.common import unique
from .refinement_identity import refinement_identifier

if TYPE_CHECKING:
    from .source_role_contract import SourceRoleTask


def validate_source_role_task(task: "SourceRoleTask") -> None:
    if task.task_id != refinement_identifier(task.model_dump(mode="json")):
        raise ValueError("Source role task identity differs")
    unique([n.id for n in task.nodes], "source role nodes")
    unique([c.id for c in task.crops], "source role crops")
    pages = [c for c in task.crops if c.part == "page"]
    local = [c for c in task.crops if c.part == "local"]
    if len(pages) != 1 or pages[0].node_id is not None:
        raise ValueError("Source role requires one complete page context")
    full = pages[0]
    if (full.source_box.x0, full.source_box.y0, full.source_box.x1, full.source_box.y1) != (
        0,
        0,
        task.page_width_pt,
        task.page_height_pt,
    ):
        raise ValueError("Source role page context is incomplete")
    if len(local) != len(task.nodes) or {c.node_id for c in local} != {n.id for n in task.nodes}:
        raise ValueError("Source role local-owner coverage differs")
    if any(
        n.page != task.page or not n.source_box.within(task.page_width_pt, task.page_height_pt)
        for n in task.nodes
    ):
        raise ValueError("Source role owner is outside its page")
    nodes = {n.id: n for n in task.nodes}
    for crop in task.crops:
        box = crop.source_box
        x0, y0, x1, y1 = crop.image_box
        if (
            crop.render_sha256 != full.render_sha256
            or not box.within(task.page_width_pt, task.page_height_pt)
            or not (0 <= x0 < x1 <= task.image.width and 0 <= y0 < y1 <= task.image.height)
            or (x1 - x0, y1 - y0)
            != (math.ceil((box.x1 - box.x0) * 2), math.ceil((box.y1 - box.y0) * 2))
        ):
            raise ValueError("Source role crop identity or physical scale differs")
        if crop.part == "local":
            if crop.node_id is None:
                raise ValueError("Local source role crop requires its owner")
            owner = nodes[crop.node_id].source_box
            if not (
                box.x0 <= owner.x0 < owner.x1 <= box.x1 and box.y0 <= owner.y0 < owner.y1 <= box.y1
            ):
                raise ValueError("Source role crop loses part of its owner")
    for i, crop in enumerate(task.crops):
        a = crop.image_box
        if any(
            min(a[2], b.image_box[2]) > max(a[0], b.image_box[0])
            and min(a[3], b.image_box[3]) > max(a[1], b.image_box[1])
            for b in task.crops[i + 1 :]
        ):
            raise ValueError("Source role evidence crops overlap")
    data = base64.b64decode(task.image.base64, validate=True)
    if (
        task.image.media_type != "image/png"
        or len(data) > 4 * 1024**2
        or len(data) != task.image.byte_length
        or max(task.image.width, task.image.height) > 2048
        or hashlib.sha256(data).hexdigest() != task.image.sha256
    ):
        raise ValueError("Source role image identity or size differs")
    with Image.open(io.BytesIO(data)) as image:
        image.verify()
    with Image.open(io.BytesIO(data)) as image:
        if (
            image.format != "PNG"
            or image.size != (task.image.width, task.image.height)
            or getattr(image, "n_frames", 1) != 1
            or image.getexif().get(274, 1) != 1
        ):
            raise ValueError("Source role image is not one upright PNG")
