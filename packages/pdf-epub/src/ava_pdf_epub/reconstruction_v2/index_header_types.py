"""Source-bound repeated-header cohort, never an OCR geometry certificate."""

from dataclasses import dataclass

from .segments import Segment

HeaderKey = tuple[str, str, int, float, float, tuple[float, ...], tuple[tuple[str, float], ...]]


@dataclass(frozen=True)
class IndexHeaderWitness:
    owner: Segment
    key: HeaderKey
