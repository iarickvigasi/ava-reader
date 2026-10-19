"""Refuse crossed/interleaved columns rather than infer order from matching letters."""

from .geometry import union
from .ocr_glyph_fragments import Fragment


def single_stream(fragments: list[Fragment]) -> bool:
    previous = None
    for _, values in fragments:
        glyphs = [g for _, g in values]
        box = union([g.box for g in glyphs])
        size = max(g.size for g in glyphs)
        for left, right in zip(glyphs, glyphs[1:], strict=False):
            if (
                right.box.x0 < left.box.x0
                or right.box.x0 - left.box.x1 > min(left.size, right.size) / 2
            ):
                return False
        if previous is not None:
            prior, prior_size = previous
            tolerance = min(box.y1 - box.y0, prior.y1 - prior.y0) / 4
            same_row = abs((box.y0 + box.y1 - prior.y0 - prior.y1) / 2) <= tolerance
            if same_row:
                if not 0 <= box.x0 - prior.x1 <= max(size, prior_size):
                    return False
            elif box.y0 < prior.y1 or min(box.x1, prior.x1) <= max(box.x0, prior.x0):
                return False
        previous = box, size
    return True
