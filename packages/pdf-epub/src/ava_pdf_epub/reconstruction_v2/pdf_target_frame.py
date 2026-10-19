"""Validate the original exact PDF viewport frame without clamping coordinates."""

import math

from pypdf import PdfReader

from ..pdf_navigation import NavigationTarget
from .observations import PageObservation


def target_frame(
    target: NavigationTarget,
    reader: PdfReader,
    observation: PageObservation,
    *,
    strict: bool = False,
) -> tuple[float, float, bool]:
    if target.page is None:
        raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
    negative_viewport = False
    page = reader.pages[target.page - 1]
    if page.rotation % 360 or float(page.cropbox.left) or float(page.cropbox.bottom):
        raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
    unit = page.get("/UserUnit", 1)
    if strict and (
        observation.number != target.page
        or observation.rotation
        or observation.width_pt != float(page.cropbox.width)
        or observation.height_pt != float(page.cropbox.height)
        or list(page.cropbox) != list(page.mediabox)
        or isinstance(unit, bool)
        or not isinstance(unit, (int, float))
        or unit != 1
    ):
        raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
    top = float(page.cropbox.top) - target.top if target.top is not None else 0
    left = target.left if target.left is not None else 0
    if not 0 <= top <= observation.height_pt or not 0 <= left <= observation.width_pt:
        # PDF32000-1 12.3.2.2/Table151: XYZ positions a viewport, whose
        # origin can precede the visible page. Keep the exact coordinates;
        # only known frames can project that view onto retained source text.
        unit = page.get("/UserUnit", 1)
        if not (
            target.fit == "/XYZ"
            and target.top is not None
            and target.left is not None
            and math.isfinite(top)
            and math.isfinite(left)
            and (top < 0 or left < 0)
            and top <= observation.height_pt
            and left <= observation.width_pt
            and observation.number == target.page
            and observation.rotation == 0
            and observation.width_pt == float(page.cropbox.width)
            and observation.height_pt == float(page.cropbox.height)
            and list(page.cropbox) == list(page.mediabox)
            and isinstance(unit, (int, float))
            and not isinstance(unit, bool)
            and unit == 1
        ):
            raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
        # Mirror assemble_pages: omitted furniture cannot own a published
        # target even when its raw glyphs precede the first retained line.
        negative_viewport = True
    return left, top, negative_viewport
