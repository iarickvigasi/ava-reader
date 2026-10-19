"""Typed destinations with explicit codepoint identity, never a string guess."""

from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import Field, field_validator

from .common import Id, Record, RelativePath


class InternalTarget(Record):
    kind: Literal["internal"]
    chapter_id: Id
    block_id: Id
    offset: int = Field(ge=0, le=200000)


class NoteTarget(Record):
    kind: Literal["note"]
    chapter_id: Id
    block_id: Id
    offset: Literal[0]


class ExternalTarget(Record):
    kind: Literal["external"]
    url: str = Field(min_length=1, max_length=2048)

    @field_validator("url")
    @classmethod
    def safe_url(cls, value: str) -> str:
        if any(c.isspace() or ord(c) < 32 for c in value) or "\\" in value:
            raise ValueError("Invalid external URL")
        parsed = urlsplit(value)
        if parsed.scheme in {"https", "http"}:
            if not parsed.hostname or parsed.username or parsed.password:
                raise ValueError("External URL requires a host without credentials")
        elif parsed.scheme != "mailto" or not parsed.path or parsed.netloc:
            raise ValueError("Unsupported external URL scheme")
        return value


LinkTarget = Annotated[InternalTarget | NoteTarget | ExternalTarget, Field(discriminator="kind")]


class Address(Record):
    resource_path: RelativePath
    fragment: Id
    target: InternalTarget
    source_page: int | None = Field(
        default=None, ge=1, le=500, exclude_if=lambda value: value is None
    )
