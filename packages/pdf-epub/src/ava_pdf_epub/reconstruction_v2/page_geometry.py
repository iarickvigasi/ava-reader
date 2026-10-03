"""Bounded source geometry for passes that do not need text, glyphs or model receipts."""

from typing import Literal

from pydantic import Field

from ..contracts.common import Record
from .observations import PageObservation


class PageGeometry(Record):
    number: int = Field(ge=1, le=500)
    width_pt: float = Field(gt=0, le=20000)
    height_pt: float = Field(gt=0, le=20000)
    rotation: Literal[0, 90, 180, 270]


def geometry_from(observation: PageObservation) -> PageGeometry:
    return PageGeometry(
        number=observation.number,
        width_pt=observation.width_pt,
        height_pt=observation.height_pt,
        rotation=observation.rotation,
    )
