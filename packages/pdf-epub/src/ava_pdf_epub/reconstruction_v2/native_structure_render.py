"""Use exact original page-render bytes, never a re-encoded recognition crop."""

import base64
import hashlib
import io
from pathlib import Path

from PIL import Image

from .observations import PageObservation
from .recognition_contract import RecognitionImage


def native_structure_render(page: PageObservation, scratch: Path) -> RecognitionImage:
    path = scratch / page.render_path
    if path.resolve().parent != (scratch / "renders").resolve():
        raise ValueError("Native structure render is outside the private render directory")
    if not 0 < path.stat().st_size <= 16777216:
        raise ValueError("Native structure original render byte bound exceeded")
    data = path.read_bytes()
    if not 0 < len(data) <= 16777216 or hashlib.sha256(data).hexdigest() != page.render_sha256:
        raise ValueError("Native structure original render content identity differs")
    with Image.open(io.BytesIO(data)) as opened:
        if opened.size != (page.render_width, page.render_height):
            raise ValueError("Native structure original render dimensions differ")
        media = {"PNG": "image/png", "JPEG": "image/jpeg"}.get(opened.format or "")
    if media is None:
        raise ValueError("Native structure original render format is unsupported")
    return RecognitionImage.model_validate(
        dict(
            media_type=media,
            sha256=page.render_sha256,
            byte_length=len(data),
            width=page.render_width,
            height=page.render_height,
            base64=base64.b64encode(data).decode(),
        )
    )
