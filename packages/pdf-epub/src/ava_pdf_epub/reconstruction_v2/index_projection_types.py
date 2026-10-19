"""Private source-row receipts; raw recognition observations remain unchanged."""

from dataclasses import dataclass

from ..contracts.source import Box
from .observations import Glyph, NativeLine
from .ocr_glyph_types import GlyphMap


@dataclass(frozen=True)
class IndexSourceRow:
    line: NativeLine
    values: tuple[tuple[int, Glyph], ...]
    column: int
    text: str
    box: Box
    size: float


@dataclass(frozen=True)
class IndexOwnerProjection:
    raw_identity: str
    raw_box: Box
    identity: str
    proof: GlyphMap
    rows: tuple[IndexSourceRow, ...]


@dataclass(frozen=True)
class IndexPageProjection:
    observation_sha256: str
    source_sha256: str
    task_sha256: str
    owners: tuple[tuple[str, str], ...]
    furniture: tuple[tuple[str, str], ...]
    entries: tuple[IndexOwnerProjection, ...]
