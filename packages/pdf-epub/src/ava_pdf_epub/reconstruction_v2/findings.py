"""Unresolved content is observable and blocking, never silently replaced or omitted."""

from typing import Literal

from pydantic import Field

from ..contracts.common import Record
from ..contracts.source import Box


class Finding(Record):
    code: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=1000)
    severity: Literal["blocking", "review", "information"]
    page: int | None = Field(default=None, ge=1, le=500)
    box: Box | None = None
    block_id: str | None = None
