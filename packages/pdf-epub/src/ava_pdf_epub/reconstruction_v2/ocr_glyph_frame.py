"""Only an exact unit, upright PDF page can corroborate observed glyph geometry."""

from typing import Any

from .observations import PageObservation


def glyph_frame_safe(source_page: Any, observation: PageObservation) -> bool:
    unit = source_page.get("/UserUnit", 1)
    return (
        not observation.rotation
        and not source_page.rotation % 360
        and not float(source_page.cropbox.left)
        and not float(source_page.cropbox.bottom)
        and list(source_page.cropbox) == list(source_page.mediabox)
        and observation.width_pt == float(source_page.cropbox.width)
        and observation.height_pt == float(source_page.cropbox.height)
        and isinstance(unit, (int, float))
        and not isinstance(unit, bool)
        and unit == 1
    )
