"""Crop source pixels, including composite labels; never synthesize illustrations."""

import hashlib
import io
from pathlib import Path
from typing import Any

from PIL import Image

from .assembly_state import AssemblyState
from .prepared import PreparedPage
from .segments import Segment


def assemble_figure(
    segment: Segment, prepared: PreparedPage, scratch: Path, state: AssemblyState
) -> dict[str, Any]:
    page, box = prepared.observation, segment.box
    with Image.open(scratch / page.render_path) as source:
        source.load()
        if (
            hashlib.sha256((scratch / page.render_path).read_bytes()).hexdigest()
            != page.render_sha256
        ):
            raise ValueError("Source render changed before image extraction")
        sx, sy = source.width / page.width_pt, source.height / page.height_pt
        crop = source.crop(
            (
                max(0, int(box.x0 * sx)),
                max(0, int(box.y0 * sy)),
                min(source.width, int(box.x1 * sx) + 1),
                min(source.height, int(box.y1 * sy) + 1),
            )
        )
        buffer = io.BytesIO()
        crop.save(buffer, format="PNG")
    data = buffer.getvalue()
    digest = hashlib.sha256(data).hexdigest()
    ident = "image-" + digest[:24]
    path = f"images/{digest}.png"
    if ident not in state.assets:
        state.assets[ident] = data
        state.resources.append(
            dict(
                id=ident,
                path=path,
                sha256=digest,
                byte_length=len(data),
                media_type="image/png",
                width=crop.width,
                height=crop.height,
                evidence=state.evidence[segment.id],
            )
        )
    return dict(
        resource_id=ident, caption_id=None, credit_id=None, alt=segment.alt, decorative=False
    )
