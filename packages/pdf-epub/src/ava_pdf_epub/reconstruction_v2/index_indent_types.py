"""Physical source measurements used by index indentation recovery."""

from dataclasses import dataclass

from .segments import Segment


@dataclass(frozen=True)
class IndexIndentGeometry:
    owner: Segment
    column: int
    size: float
    margins: tuple[float, ...]
    font: str
