"""Send ambiguous native structure for source-bound review; known excluded grids stop early."""

from pathlib import Path

from ..contracts.source import Box
from .geometry import rectangle
from .make_task import make_task
from .native_page import native_page
from .observations import PageObservation
from .observe_tables import TableObservation
from .recognition_contract import RecognitionTask
from .segments import Segment


def route_native(
    page: PageObservation,
    tables: list[TableObservation],
    regions: list[Box],
    source_hash: str,
    scratch: Path,
) -> tuple[list[Segment], list[RecognitionTask]]:
    for table in tables:
        if (
            len(table.cells) > 20
            or any(len(row) > 8 for row in table.cells)
            or any(cell is None for row in table.cells for cell in row)
        ):
            raise ValueError("Essential table exceeds the supported grid profile")
    try:
        segments = native_page(page, tables, set(), regions)
        if any(segment.kind == "unsupported" for segment in segments):
            raise ValueError("Native structural interpretation requires review")
    except ValueError:
        box = rectangle((0, 0, page.width_pt, page.height_pt), page.width_pt, page.height_pt)
        return [], [make_task(page, source_hash, box, scratch, purpose="pdf_structure_repair")]
    return segments, [make_task(page, source_hash, box, scratch) for box in regions]
