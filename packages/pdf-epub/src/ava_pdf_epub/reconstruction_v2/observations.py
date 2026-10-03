"""Private source observations, separate from accepted book content and provider messages."""

from typing import Literal

from pydantic import Field, model_validator

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


class RequiredRegion(Record):
    style: Style | None = None
    kind: Literal["text", "appearance", "inline_style"]
    box: Box

    @model_validator(mode="after")
    def style_role(self) -> "RequiredRegion":
        if (self.kind == "inline_style") != (self.style is not None):
            raise ValueError(
                "Inline annotation regions require a source style; other regions do not"
            )
        return self


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

    required_regions: list[RequiredRegion] = Field(default_factory=list, max_length=1000)
