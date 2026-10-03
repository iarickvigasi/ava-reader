"""Only uniform near-white rendered pages qualify as blank without model tokens."""

from pathlib import Path

from PIL import Image

from .observations import PageObservation


def blank_page(page: PageObservation, scratch: Path) -> bool:
    with Image.open(scratch / page.render_path) as image:
        histogram = image.convert("L").histogram()
    return not any(histogram[:250]) and sum(bool(count) for count in histogram) == 1
