"""Fixed readable heading/context geometry; source pixels never include the sheet labels."""

import hashlib
import math

from .geometry import rectangle
from .printed_title_contract import PrintedTitleNode

LABEL_HEIGHT = 32
GAP = 16


def title_geometry(node: PrintedTitleNode):
    box, width, height = node.box, node.page_width_pt, node.page_height_pt
    title = rectangle((box.x0 - 4, box.y0 - 4, box.x1 + 4, box.y1 + 4), width, height)
    context = rectangle((0, max(0, box.y0 - 100), width, min(height, box.y1 + 220)), width, height)
    key = hashlib.sha256(node.id.encode()).hexdigest()[:24]
    pieces, top = [], 0
    for part, crop in [("title", title), ("context", context)]:
        w, h = math.ceil((crop.x1 - crop.x0) * 2), math.ceil((crop.y1 - crop.y0) * 2)
        pieces.append(
            (part + "-" + key, part, crop, [0, top + LABEL_HEIGHT, w, top + LABEL_HEIGHT + h])
        )
        top += LABEL_HEIGHT + h + GAP
    return pieces, max(piece[3][2] for piece in pieces), top - GAP
