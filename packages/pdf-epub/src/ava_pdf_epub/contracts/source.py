"""Page coordinates refer to normalized upright source pages, not reader screens."""

from typing import Literal, Self

from pydantic import Field, model_validator

from .common import Digest, Id, Record, unique


class Box(Record):
    coordinate_space: Literal["page_points_top_left", "normalized_top_left"]
    x0: float = Field(ge=0, le=20000)
    y0: float = Field(ge=0, le=20000)
    x1: float = Field(gt=0, le=20000)
    y1: float = Field(gt=0, le=20000)

    @model_validator(mode="after")
    def ordered(self) -> Self:
        if self.x0 >= self.x1 or self.y0 >= self.y1:
            raise ValueError("Empty or reversed source box")
        if self.coordinate_space == "normalized_top_left" and max(self.x1, self.y1) > 1:
            raise ValueError("Normalized coordinates exceed unit rectangle")
        return self

    def within(self, width: float, height: float) -> bool:
        return self.coordinate_space == "normalized_top_left" or (
            self.x1 <= width and self.y1 <= height
        )


class Evidence(Record):
    page: int = Field(ge=1, le=500)
    region_id: Id
    method: Literal["native", "ocr", "review", "replay", "render"]
    box: Box


class SourceRegion(Record):
    id: Id
    box: Box
    band: int = Field(ge=0, le=2000)
    column: Literal[0, 1, 2]
    role: Literal["content", "cover", "furniture", "blank", "unsupported"]
    route: Literal["native", "ocr", "replay", "render", "blank", "unresolved"]


class SourcePage(Record):
    number: int = Field(ge=1, le=500)
    width_pt: float = Field(gt=0, le=20000)
    height_pt: float = Field(gt=0, le=20000)
    original_rotation: Literal[0, 90, 180, 270]
    label: str | None = Field(default=None, max_length=100)
    regions: list[SourceRegion] = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def geometry(self) -> Self:
        unique([r.id for r in self.regions], "source region")
        if any(not r.box.within(self.width_pt, self.height_pt) for r in self.regions):
            raise ValueError("Source region outside page")
        order = [(r.band, r.column) for r in self.regions if r.role == "content"]
        if order != sorted(order):
            raise ValueError("Source regions must follow band and left-to-right column order")
        from .source_geometry import validate_bands

        validate_bands(self)
        return self


class SourcePdf(Record):
    sha256: Digest
    byte_length: int = Field(ge=1, le=52428800)
    page_count: int = Field(ge=1, le=500)
