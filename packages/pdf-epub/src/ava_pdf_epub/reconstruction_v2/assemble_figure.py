"""Crop source pixels, including composite labels; never synthesize illustrations."""

import hashlib
import io
from pathlib import Path
from typing import Any

from PIL import Image

from ..contracts.private_files import snapshot
from .assembly_state import AssemblyState
from .prepared import PreparedPage
from .segments import Segment


def assemble_figure(
    segment: Segment, prepared: PreparedPage, scratch: Path, state: AssemblyState
) -> dict[str, Any]:
    if segment.source_image is not None:
        asset = segment.source_image
        if not asset.qualified:
            raise ValueError("Source image is not qualified")
        data = snapshot(scratch, asset.path, 1048576)
        if len(data) != asset.byte_length or hashlib.sha256(data).hexdigest() != asset.sha256:
            raise ValueError("Source image changed before assembly")
        with Image.open(io.BytesIO(data)) as original:
            original.load()
            if (
                original.format != ("PNG" if asset.media_type == "image/png" else "JPEG")
                or original.mode not in {"RGB", "L"}
                or original.size != (asset.width, asset.height)
            ):
                raise ValueError("Source image dimensions or paint differ")
        width, height = asset.width, asset.height
        media_type = asset.media_type
    else:
        data, width, height = _source_crop(segment, prepared, scratch)
        media_type = "image/png"
    digest = hashlib.sha256(data).hexdigest()
    ident = "image-" + digest[:24]
    suffix = "png" if media_type == "image/png" else "jpg"
    path = f"images/{digest}.{suffix}"
    if ident not in state.assets:
        state.assets[ident] = data
        state.resources.append(
            dict(
                id=ident,
                path=path,
                sha256=digest,
                byte_length=len(data),
                media_type=media_type,
                width=width,
                height=height,
                evidence=state.evidence[segment.id],
            )
        )
    return dict(
        resource_id=ident,
        caption_id=None,
        credit_id=None,
        alt=segment.alt,
        decorative=segment.decorative,
    )


def _source_crop(segment: Segment, prepared: PreparedPage, scratch: Path) -> tuple[bytes, int, int]:
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
    return data, crop.width, crop.height
