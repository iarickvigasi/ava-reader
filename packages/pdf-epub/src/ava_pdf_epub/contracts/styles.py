"""Finite source typography; unknown is null, distinct from observed zero/false."""

from typing import Any, Literal

from pydantic import Field, SerializerFunctionWrapHandler, model_serializer

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
    block_indent_em: float | None = Field(default=None, ge=0, le=6)
    space_before_em: float | None = Field(default=None, ge=0, le=5)
    space_after_em: float | None = Field(default=None, ge=0, le=5)
    line_height: float | None = Field(default=None, ge=0.5, le=3)

    color: str | None = Field(default=None, pattern=r"^#[0-9a-f]{6}$")
    background_color: str | None = Field(default=None, pattern=r"^#[0-9a-f]{6}$")
    decoration_color: str | None = Field(default=None, pattern=r"^#[0-9a-f]{6}$")
    underline: bool | None = None
    strike_through: bool | None = None

    @model_serializer(mode="wrap")
    def compatible_wire(self, handler: SerializerFunctionWrapHandler) -> dict[str, Any]:
        # New unknown fields must not change existing immutable content digests or
        # the exact visible projection verified during generated EPUB reimport.
        values: dict[str, Any] = handler(self)
        for key in ("color", "background_color", "decoration_color", "underline", "strike_through",
                    "block_indent_em"):
            if values.get(key) is None:
                values.pop(key, None)
        return values
