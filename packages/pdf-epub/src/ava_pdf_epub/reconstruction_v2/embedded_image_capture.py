"""Optional bounded source-image capture; unknown appearances keep the existing raster route."""

import hashlib
import io
import os
from pathlib import Path
from typing import Any, Literal

from PIL import Image
from pypdf import PdfReader
from pypdf.generic import DictionaryObject, NumberObject

from ..contracts.private_files import snapshot
from .embedded_image import EmbeddedImage
from .embedded_image_paint import image_paint_boxes


def capture_image_assets(
    page: Any, reader: PdfReader, scratch: Path, names: set[str]
) -> dict[tuple[float, float, float, float], EmbeddedImage]:
    if not names:
        return {}
    boxes = image_paint_boxes(page, reader)
    result = {}
    for name, bounds in boxes.items():
        if name not in names:
            continue
        obj = page.get("/Resources", {}).get("/XObject", {}).get(name)
        if obj is None:
            continue
        obj = obj.get_object()
        if obj.get("/Subtype") != "/Image" or any(
            k in obj for k in ["/Mask", "/SMask", "/ImageMask", "/Decode", "/SMaskInData"]
        ):
            continue
        width, height = obj.get("/Width"), obj.get("/Height")
        if (
            not isinstance(width, int)
            or not isinstance(height, int)
            or not (0 < width <= 1024 and 0 < height <= 1024 and width * height <= 262144)
        ):
            continue
        if (
            str(obj.get("/ColorSpace")) not in {"/DeviceRGB", "/DeviceGray"}
            or obj.get("/BitsPerComponent") != 8
        ):
            continue
        # The decoder does not apply arbitrary DCT DecodeParms. Only an explicit
        # default YCbCr transform corroborated by the JPEG itself is equivalent.
        params = obj.get("/DecodeParms")
        explicit_transform = False
        if params is not None:
            params = params.get_object()
            if not isinstance(params, DictionaryObject):
                continue
            if params:
                transform = params.get("/ColorTransform")
                if (
                    set(params) != {"/ColorTransform"}
                    or not isinstance(transform, NumberObject)
                    or int(transform) != 1
                    or obj.get("/Filter") != "/DCTDecode"
                    or obj.get("/ColorSpace") != "/DeviceRGB"
                ):
                    continue
                explicit_transform = True
        try:
            data = page.images[name].data
            if not 0 < len(data) <= 1048576:
                continue
            with Image.open(io.BytesIO(data)) as image:
                image.load()
                if (
                    image.format not in {"PNG", "JPEG"}
                    or image.mode not in {"RGB", "L"}
                    or image.size != (width, height)
                    or any(k in image.info for k in ["icc_profile", "exif", "transparency"])
                ):
                    continue
                if explicit_transform and (
                    image.format != "JPEG"
                    or "jfif" not in image.info
                    or image.info.get("adobe_transform", 1) != 1
                ):
                    continue
        except (OSError, ValueError, KeyError):
            continue
        digest = hashlib.sha256(data).hexdigest()
        directory = scratch / "source-images"
        directory.mkdir(mode=0o700, exist_ok=True)
        media_type: Literal["image/png", "image/jpeg"] = (
            "image/png" if image.format == "PNG" else "image/jpeg"
        )
        filename = digest + (".png" if media_type == "image/png" else ".jpg")
        destination = directory / filename
        if destination.exists():
            if snapshot(directory, filename, 1048576) != data:
                raise ValueError("Source image changed during capture")
        else:
            # Avoid unbounded optional scratch growth for books with many distinct pictures.
            if sum(p.stat().st_size for p in directory.iterdir()) + len(data) > 16777216:
                continue
            descriptor = os.open(
                destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600
            )
            with os.fdopen(descriptor, "wb") as output:
                output.write(data)
        x0, y0, x1, y1 = bounds
        top = float(page.cropbox.height)
        result[(x0, top - y1, x1, top - y0)] = EmbeddedImage(
            sha256=digest,
            byte_length=len(data),
            width=width,
            height=height,
            path=f"source-images/{filename}",
            media_type=media_type,
        )
    return result
