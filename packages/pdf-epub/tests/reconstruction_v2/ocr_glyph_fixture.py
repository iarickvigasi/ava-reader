"""An authored source row can contain two independently owned physical columns."""

from ava_pdf_epub.reconstruction_v2.observations import NativeLine
from ava_pdf_epub.reconstruction_v2.segments import Segment

from .test_ocr_link_context import line
from .test_pdf_links import box, observation
from .test_refinement_grouping import segment


def columns():
    left, right = line("left", "noend54,", 0, 20), line("right", "noend54,", 65, 20)
    joined = NativeLine(
        id="joined",
        box=box(0, 20, 97, 30),
        text=left.text + " " + right.text,
        glyphs=[*left.glyphs, *right.glyphs],
        style=left.style,
    )
    page = observation().model_copy(update={"lines": [joined]})
    owners: list[Segment] = [
        segment("left", "no end 54,").model_copy(update={"box": left.box}),
        segment("right", "no end 54,").model_copy(update={"box": right.box}),
    ]
    return page, owners
