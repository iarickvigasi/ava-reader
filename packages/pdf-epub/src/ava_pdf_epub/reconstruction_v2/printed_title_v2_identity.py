"""Self-contained typed/hash/geometry checks do not broaden historical task schemas."""

import base64
import hashlib
import io
from typing import TYPE_CHECKING

from PIL import Image

from ..contracts.common import text_digest
from .refinement_identity import refinement_identifier

if TYPE_CHECKING:
    from .printed_title_v2_contract import FrontmatterTitleTask


def validate_frontmatter_title_task(task: "FrontmatterTitleTask") -> None:
    from .printed_title_v2_geometry import frontmatter_title_geometry

    if task.task_id != refinement_identifier(task.model_dump(mode="json")):
        raise ValueError("Frontmatter title task identity differs")
    if len({n.id for n in task.nodes}) != len(task.nodes):
        raise ValueError("Repeated frontmatter title source node")
    numbers = [p.page for p in task.pages]
    if (
        numbers != sorted({1, *(n.page for n in task.nodes)})
        or max(numbers) > task.source_page_count
    ):
        raise ValueError("Frontmatter title context pages differ")
    if [n.page for n in task.nodes] != sorted(n.page for n in task.nodes):
        raise ValueError("Frontmatter title source order differs")
    pages = {p.page: p for p in task.pages}
    for n in task.nodes:
        p = pages[n.page]
        if (
            text_digest(n.text) != n.text_sha256
            or n.box.coordinate_space != "page_points_top_left"
            or not n.box.within(n.page_width_pt, n.page_height_pt)
        ):
            raise ValueError("Frontmatter title source text/box differs")
        if (n.page_width_pt, n.page_height_pt, n.render_sha256) != (
            p.page_width_pt,
            p.page_height_pt,
            p.render_sha256,
        ):
            raise ValueError("Frontmatter title node context identity differs")
    pieces, width, height = frontmatter_title_geometry(task.nodes, task.pages)
    expected = [
        dict(
            id=i,
            part=p,
            node_id=n,
            page=page,
            source_box=b.model_dump(),
            render_sha256=d,
            image_box=xy,
        )
        for i, p, n, page, b, d, xy in pieces
    ]
    if [c.model_dump(mode="json") for c in task.crops] != expected or (
        task.image.width,
        task.image.height,
    ) != (width, height):
        raise ValueError("Frontmatter title requires its exact complete source panels")
    data = base64.b64decode(task.image.base64, validate=True)
    if (
        len(data) > 4 * 1024**2
        or len(data) != task.image.byte_length
        or hashlib.sha256(data).hexdigest() != task.image.sha256
    ):
        raise ValueError("Frontmatter title image identity differs")
    with Image.open(io.BytesIO(data)) as opened:
        opened.verify()
    with Image.open(io.BytesIO(data)) as opened:
        if (
            opened.format != "PNG"
            or opened.size != (width, height)
            or getattr(opened, "n_frames", 1) != 1
            or opened.getexif().get(274, 1) != 1
        ):
            raise ValueError("Frontmatter title image must be an upright source PNG")
        opened.load()
