"""Map bounded annotation quads through CropBox and cardinal rotation, never a broad Rect guess."""

import math
from pathlib import Path
from typing import Any

from PIL import Image

from ..annotation_kind import annotation_kind
from ..contracts.source import Box
from .annotation_markup import markup_style
from .observations import PageObservation, RequiredRegion


def upright_box(page: Any, rect: list[float]) -> Box:
    crop = page.cropbox
    width, height = float(crop.width), float(crop.height)
    rotation = int(page.rotation) % 360
    points = []
    for raw_x in [rect[0], rect[2]]:
        for raw_y in [rect[1], rect[3]]:
            x, y = raw_x - float(crop.left), raw_y - float(crop.bottom)
            if not 0 <= x <= width or not 0 <= y <= height:
                raise ValueError("PDF_ANNOTATION_VISIBILITY_REQUIRES_REVIEW")
            if rotation == 0:
                points.append((x, height - y))
            elif rotation == 90:
                points.append((y, x))
            elif rotation == 180:
                points.append((width - x, y))
            elif rotation == 270:
                points.append((height - y, width - x))
            else:
                raise ValueError("PDF_ANNOTATION_GEOMETRY_INVALID")
    return Box(
        coordinate_space="page_points_top_left",
        x0=min(p[0] for p in points),
        y0=min(p[1] for p in points),
        x1=max(p[0] for p in points),
        y1=max(p[1] for p in points),
    )


def annotation_regions(
    page: Any, *, observation: PageObservation | None = None, scratch: Path | None = None
) -> list[RequiredRegion]:
    result = []
    for reference in page.get("/Annots", []):
        annotation = reference.get_object()
        if annotation_kind(annotation) != "visible":
            continue
        rect = [float(v) for v in annotation["/Rect"]]
        box = upright_box(page, rect)
        subtype = annotation["/Subtype"]
        if (
            subtype in {"/Highlight", "/Underline", "/StrikeOut"}
            and observation is not None
            and scratch is not None
        ):
            quads = annotation.get("/QuadPoints", [])
            if not quads or len(quads) % 8 or len(quads) > 1000:
                raise ValueError("PDF_ANNOTATION_TEXT_MAPPING_REQUIRES_REVIEW")
            values = [float(v) for v in quads]
            if not all(math.isfinite(v) for v in values):
                raise ValueError("PDF_ANNOTATION_GEOMETRY_INVALID")
            with Image.open(scratch / observation.render_path) as image:
                for offset in range(0, len(values), 8):
                    quad = values[offset : offset + 8]
                    xs, ys = sorted(set(quad[::2])), sorted(set(quad[1::2]))
                    if (
                        len(xs) != 2
                        or len(ys) != 2
                        or len(set(zip(quad[::2], quad[1::2], strict=True))) != 4
                    ):
                        raise ValueError("PDF_ANNOTATION_TEXT_MAPPING_REQUIRES_REVIEW")
                    if (
                        not rect[0] <= xs[0] < xs[1] <= rect[2]
                        or not rect[1] <= ys[0] < ys[1] <= rect[3]
                    ):
                        raise ValueError("PDF_ANNOTATION_GEOMETRY_INVALID")
                    local = upright_box(page, [xs[0], ys[0], xs[1], ys[1]])
                    style = markup_style(
                        annotation, local, image, observation.width_pt, observation.height_pt
                    )
                    result.append(RequiredRegion(kind="inline_style", box=local, style=style))
        else:
            result.append(
                RequiredRegion(kind="text" if subtype == "/FreeText" else "appearance", box=box)
            )
        if len(result) > 1000:
            raise ValueError("PDF_RESOURCE_LIMIT")
    return result
