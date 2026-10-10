"""Check actual raster bytes before writing them; never read a caller-supplied path."""

import hashlib
import io

from PIL import Image

from ..contracts.book import CanonicalBookV2
from .paths import asset_path

MAX_RESOURCE_BYTES = 200 * 1024 * 1024
MAX_EXPANDED_BYTES = 256 * 1024 * 1024


def validate_assets(book: CanonicalBookV2, assets: dict[str, bytes]) -> dict[str, bytes]:
    if set(assets) != {r.id for r in book.resources}:
        raise ValueError("Required resource inventory differs")
    if sum(len(data) for data in assets.values()) > MAX_RESOURCE_BYTES:
        raise ValueError("Resource bytes exceed bounded export")
    output = {}
    for resource in book.resources:
        data = assets[resource.id]
        if len(data) != resource.byte_length or hashlib.sha256(data).hexdigest() != resource.sha256:
            raise ValueError("Required resource bytes differ: " + resource.id)
        with Image.open(io.BytesIO(data)) as image:
            if image.size != (resource.width, resource.height):
                raise ValueError("Required resource geometry differs: " + resource.id)
            expected = "PNG" if resource.media_type == "image/png" else "JPEG"
            if image.format != expected:
                raise ValueError("Required resource media type differs: " + resource.id)
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            if getattr(image, "n_frames", 1) != 1 or image.getexif().get(274, 1) != 1:
                raise ValueError(
                    "Required resource is not a normalized static image: " + resource.id
                )
            image.load()
        output["EPUB/" + asset_path(resource)] = data
    return output
