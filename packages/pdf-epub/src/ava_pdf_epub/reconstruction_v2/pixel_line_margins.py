"""Return complete clean text-line margins; ink measurements never invent a font-em size."""

from PIL import Image


def pixel_line_margins(image: Image.Image, pixels_per_point: float) -> list[float]:
    ink = image.convert("L").point(lambda value: 255 if value < 150 else 0)
    bounds = ink.getbbox()
    if bounds is None or 0 in bounds[:2] or bounds[2] == ink.width or bounds[3] == ink.height:
        return []
    if ink.histogram()[255] > ink.width * ink.height * 0.5:
        return []
    # Long vertical rules and solid artwork cannot qualify text-line margins.
    if any(
        ink.crop((x, 0, x + 1, ink.height)).histogram()[255] > ink.height * 0.7
        for x in range(ink.width)
    ):
        return []
    bands: list[tuple[int, int, int]] = []
    for y in range(ink.height):
        row = ink.crop((0, y, ink.width, y + 1))
        bounds = row.getbbox()
        if bounds and row.histogram()[255] >= 3 * pixels_per_point:
            if bands and y <= bands[-1][1] + 2:
                start, _, left = bands[-1]
                bands[-1] = (start, y, min(left, bounds[0]))
            else:
                bands.append((y, y, bounds[0]))
    lines = [b for b in bands if b[1] - b[0] >= 3 * pixels_per_point]
    if not lines or len(lines) > 100:
        return []
    if lines[0][0] == 0 or lines[-1][1] == ink.height - 1:
        return []
    for start, end, left in lines:
        band = ink.crop((0, start, ink.width, end + 1))
        bounds = band.getbbox()
        if left == 0 or bounds is None or bounds[2] == ink.width:
            return []
        if end - start > 20 * pixels_per_point:
            return []
        density = band.histogram()[255] / ((bounds[2] - left) * band.height)
        if density > 0.65:
            return []
        empty = longest = 0
        for x in range(left, bounds[2]):
            empty = empty + 1 if not band.crop((x, 0, x + 1, band.height)).getbbox() else 0
            longest = max(longest, empty)
        if longest < pixels_per_point:
            return []
    return [left / pixels_per_point for _, _, left in lines]
