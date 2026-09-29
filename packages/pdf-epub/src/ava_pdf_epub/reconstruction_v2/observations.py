"""Private source observations, separate from accepted book content and provider messages."""

from typing import Literal

from pydantic import Field

from ..contracts.common import Digest, Record
from ..contracts.source import Box
from ..contracts.styles import Style


class Glyph(Record):
    text: str = Field(min_length=1, max_length=100)
    box: Box
    font: str = Field(max_length=500)
    size: float = Field(gt=0, le=500)
    visible: bool


class NativeLine(Record):
    id: str
    box: Box
    text: str = Field(max_length=200000)
    glyphs: list[Glyph] = Field(max_length=200000)
    style: Style


class Graphic(Record):
    box: Box
    kind: Literal["image", "vector"]


class PageObservation(Record):
    number: int = Field(ge=1, le=500)
    width_pt: float = Field(gt=0, le=20000)
    height_pt: float = Field(gt=0, le=20000)
    rotation: Literal[0, 90, 180, 270]
    render_path: str
    render_sha256: Digest
    render_width: int = Field(ge=1, le=6000)
    render_height: int = Field(ge=1, le=6000)
    lines: list[NativeLine] = Field(max_length=10000)
    graphics: list[Graphic] = Field(max_length=10000)
    risks: list[str] = Field(max_length=100)
