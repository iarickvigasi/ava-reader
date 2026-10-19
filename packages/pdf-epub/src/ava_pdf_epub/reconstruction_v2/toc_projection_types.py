"""Original source fragments are provenance; projected receipts grant no caller authority."""

from dataclasses import dataclass

from ..contracts.source import Box
from .ocr_glyph_fragments import Fragment
from .segments import Segment


@dataclass(frozen=True)
class TocSourceEntry:
    annotation_number: int | None
    target_page: int | None
    caller: Box | None
    fragments: list[Fragment]


@dataclass(frozen=True)
class TocOwnerProjection:
    raw: Segment
    owner: Segment
    source: TocSourceEntry
