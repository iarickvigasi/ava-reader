"""Authored source geometry, including a fused row; no private source or model response."""

from ava_pdf_epub.reconstruction_v2.observations import NativeLine

from .test_ocr_link_context import line
from .test_pdf_links import box, observation


def index_page(*, header="General index", fused=False, introduction=False):
    lines = [line("title", header, 36, 36)]
    if introduction:
        lines.append(line("intro", "This introduction explains the printed references.", 36, 62))
    for i in range(6):
        left = line(f"left{i}", f"alpha{i} {i + 10}", 36 if i % 2 == 0 else 44, 100 + i * 14)
        right = line(f"right{i}", f"omega{i} {i + 20}", 178, 100 + i * 14)
        if fused and i == 2:
            lines.append(
                NativeLine(
                    id="fused",
                    text=left.text + " " + right.text,
                    box=box(left.box.x0, left.box.y0, right.box.x1, right.box.y1),
                    glyphs=[*left.glyphs, *right.glyphs],
                    style=left.style,
                )
            )
        else:
            lines.extend([right, left])  # Reverse stream order cannot interleave the columns.
    return observation().model_copy(
        update={
            "width_pt": 346.0,
            "height_pt": 582.0,
            "lines": lines,
            "render_width": 346,
            "render_height": 582,
        }
    )
