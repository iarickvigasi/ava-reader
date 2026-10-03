"""Corroborate finite markup colors and strokes against actual source pixels."""

import math
from typing import Any

from PIL import Image

from ..contracts.source import Box
from ..contracts.styles import Style


def markup_style(
    annotation: Any, box: Box, image: Image.Image, width: float, height: float
) -> Style:
    components = annotation.get("/C", [])
    if len(components) not in {1, 3}:
        raise ValueError("PDF_ANNOTATION_STYLE_REQUIRES_REVIEW")
    try:
        values = [float(c) for c in components]
    except (TypeError, ValueError, OverflowError):
        raise ValueError("PDF_ANNOTATION_STYLE_REQUIRES_REVIEW") from None
    if not all(math.isfinite(c) and 0 <= c <= 1 for c in values):
        raise ValueError("PDF_ANNOTATION_STYLE_REQUIRES_REVIEW")
    # ISO 32000 annotation C: one component is DeviceGray, three are
    # DeviceRGB. Both still require corroboration against rendered pixels.
    if len(values) == 1:
        values *= 3
    rgb = tuple(round(c * 255) for c in values)
    color = "#" + "".join(f"{c:02x}" for c in rgb)
    crop = (image if image.mode == "RGB" else image.convert("RGB")).crop(
        (
            int(box.x0 / width * image.width),
            int(box.y0 / height * image.height),
            int(box.x1 / width * image.width),
            int(box.y1 / height * image.height),
        )
    )
    if crop.width < 2 or crop.height < 2:
        raise ValueError("PDF_ANNOTATION_STYLE_REQUIRES_REVIEW")
    subtype = annotation["/Subtype"]
    if subtype == "/Highlight":
        crop.thumbnail((800, 800))
    pixels = crop.tobytes()
    matches = [
        max(abs(pixels[i + k] - rgb[k]) for k in range(3)) <= 15 for i in range(0, len(pixels), 3)
    ]
    if subtype == "/Highlight":
        proved = sum(matches) >= 0.35 * crop.width * crop.height
        properties: dict[str, object] = {"background_color": color}
    else:
        # A continuous stroke is distinct from dark text merely touching the box.
        rows = (
            range(crop.height // 2, crop.height)
            if subtype == "/Underline"
            else range(crop.height // 4, 3 * crop.height // 4)
        )
        proved = any(
            sum(matches[y * crop.width : (y + 1) * crop.width]) >= 0.7 * crop.width for y in rows
        )
        properties = {
            "underline" if subtype == "/Underline" else "strike_through": True,
            "decoration_color": color,
        }
    if not proved:
        raise ValueError("PDF_ANNOTATION_STYLE_REQUIRES_REVIEW")
    return Style.model_validate({"id": "source-annotation", **properties})


def glyph_color(image: Image.Image, box: Box, width: float, height: float, background: str) -> str:
    """Retain the modal contrasting glyph ink, not inherited reader-theme text color."""
    rgb = (int(background[1:3], 16), int(background[3:5], 16), int(background[5:7], 16))
    crop = (image if image.mode == "RGB" else image.convert("RGB")).crop(
        (
            int(box.x0 / width * image.width),
            int(box.y0 / height * image.height),
            int(box.x1 / width * image.width),
            int(box.y1 / height * image.height),
        )
    )
    colors = crop.getcolors(maxcolors=100000) or []

    def luminance(color: tuple[int, int, int]) -> float:
        values = [v / 255 for v in color]
        linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values]
        return sum(v * weight for v, weight in zip(linear, (0.2126, 0.7152, 0.0722), strict=True))

    background_luminance = luminance(rgb)
    candidates: list[tuple[int, tuple[int, int, int]]] = []
    for count, pixel in colors:
        if not isinstance(pixel, tuple) or len(pixel) != 3:
            raise ValueError("PDF_ANNOTATION_TEXT_MAPPING_REQUIRES_REVIEW")
        color = (pixel[0], pixel[1], pixel[2])
        foreground_luminance = luminance(color)
        contrast = (max(foreground_luminance, background_luminance) + 0.05) / (
            min(foreground_luminance, background_luminance) + 0.05
        )
        if count >= 3 and contrast >= 3:
            candidates.append((count, color))
    if not candidates:
        raise ValueError("PDF_ANNOTATION_TEXT_MAPPING_REQUIRES_REVIEW")
    count, color = max(candidates)
    if count < 3:
        raise ValueError("PDF_ANNOTATION_TEXT_MAPPING_REQUIRES_REVIEW")
    return "#" + "".join(f"{c:02x}" for c in color)
