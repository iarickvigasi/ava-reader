"""Check incoming OCR line indentation from immutable pixels, not an omitted style field."""

from pathlib import Path

from PIL import Image

from .assembly_state import AssemblyState
from .prepared import PreparedPage
from .segments import Segment

CROP_PADDING_PT = 3


def continuation_margins(
    segments: list[Segment], prepared: list[PreparedPage], scratch: Path, state: AssemblyState
) -> None:
    candidates = set()
    for previous, current in zip(segments, segments[1:], strict=False):
        a, b = state.placements[previous.id], state.placements[current.id]
        if a[:2] == b[:2] and a[2] == 1 and b[2] == 2 and current.method == "ocr":
            if previous.kind == current.kind == "paragraph":
                candidates.add(current.id)
    for page in prepared:
        selected = [s for s in segments if s.page == page.observation.number and s.id in candidates]
        if not selected:
            continue
        observed = page.observation
        with Image.open(scratch / observed.render_path) as raw:
            image = raw.convert("L")
            sx, sy = image.width / observed.width_pt, image.height / observed.height_pt
            for segment in selected:
                box = segment.box
                pad = CROP_PADDING_PT
                crop = image.crop(
                    (
                        max(0, int((box.x0 - pad) * sx)),
                        max(0, int((box.y0 - pad) * sy)),
                        min(image.width, int((box.x1 + pad) * sx)),
                        min(image.height, int((box.y1 + pad) * sy)),
                    )
                )
                state.flush_starts[segment.id] = flush_first_line(crop, sx)


def flush_first_line(image: Image.Image, pixels_per_point: float) -> bool:
    """Two or more visible line bands are required; single-line/cropped/noisy cases stay unknown."""
    ink = image.point(lambda value: 255 if value < 150 else 0)
    bands: list[tuple[int, int, int]] = []
    for y in range(ink.height):
        row = ink.crop((0, y, ink.width, y + 1))
        bounds = row.getbbox()
        if bounds and row.histogram()[255] >= 3:
            left = bounds[0]
            if bands and y <= bands[-1][1] + 2:
                first, _, margin = bands[-1]
                bands[-1] = (first, y, min(margin, left))
            else:
                bands.append((y, y, left))
    lines = [line for line in bands if line[1] - line[0] >= 3 * pixels_per_point]
    if len(lines) < 2 or lines[0][0] == 0 or lines[-1][1] == ink.height - 1:
        return False
    return abs(lines[0][2] - min(line[2] for line in lines[1:])) <= pixels_per_point
