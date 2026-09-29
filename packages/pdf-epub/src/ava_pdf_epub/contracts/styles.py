"""Finite source typography; unknown is null, distinct from observed zero/false."""

from typing import Literal

from pydantic import Field

from .common import Id, Record


class Style(Record):
    id: Id
    family: Literal["serif", "sans-serif", "monospace"] | None = None
    align: Literal["start", "left", "right", "center", "justify"] | None = None
    bold: bool | None = None
    italic: bool | None = None
    small_caps: bool | None = None
    vertical_align: Literal["baseline", "super", "sub"] | None = None
    relative_size: float | None = Field(default=None, ge=0.5, le=3)
    indent_em: float | None = Field(default=None, ge=-3, le=6)
    space_before_em: float | None = Field(default=None, ge=0, le=5)
    space_after_em: float | None = Field(default=None, ge=0, le=5)
    line_height: float | None = Field(default=None, ge=0.5, le=3)
