"""Bounded visible character patterns route raster text; this is not transcription authority."""

from PIL import Image, ImageOps

MAX_WIDTH, MAX_HEIGHT = 600, 900
INK_THRESHOLD = 150


def raster_text(crop: Image.Image) -> bool:
    if crop.width < 40 or crop.height < 20:
        return False
    scale = min(1, MAX_WIDTH / crop.width, MAX_HEIGHT / crop.height)
    size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    small = crop.convert("L").resize(size)
    histogram = small.histogram()
    background = histogram.index(max(histogram))
    dark = sum(histogram[: max(0, background - 40)])
    light = sum(histogram[min(256, background + 40) :])
    if light > dark:
        small = ImageOps.invert(small)
        background = 255 - background
    threshold = min(INK_THRESHOLD, max(1, background - 40))
    pixels = small.tobytes()
    active = [
        sum(v < threshold for v in pixels[y * small.width : (y + 1) * small.width])
        > small.width * 0.015
        for y in range(small.height)
    ]
    return any(
        _character_band(pixels, small.width, start, end, threshold) for start, end in _bands(active)
    )


def _bands(active: list[bool]) -> list[tuple[int, int]]:
    bands = []
    start = None
    for index, ink in enumerate([*active, False]):
        if ink and start is None:
            start = index
        if not ink and start is not None:
            bands.append((start, index))
            start = None
    return bands


def _character_band(pixels: bytes, width: int, start: int, end: int, threshold: int) -> bool:
    height = end - start
    if height < 3:
        return False
    columns = [
        sum(pixels[y * width + x] < threshold for y in range(start, end)) for x in range(width)
    ]
    runs = _bands([ink >= max(1, height * 0.1) for ink in columns])
    if len(runs) < 2 or any(right - left > height * 2 for left, right in runs):
        return False
    glyphs = sum(
        sum(columns[left:right]) / ((right - left) * height) < 0.85 for left, right in runs
    )
    if glyphs < max(2, len(runs) / 2):
        return False
    occupied_width = runs[-1][1] - runs[0][0]
    density = sum(columns) / (occupied_width * height)
    return 0.08 <= density <= 0.7
