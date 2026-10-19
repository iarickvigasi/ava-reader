"""An invalid-context candidate is not an accepted recognition span."""

from typing import Literal

from pydantic import Field

from ..contracts.common import Record
from .recognition_anchor_context import AnchorContextSlot


class OverflowContextAnchor(Record):
    exact_text: str = Field(min_length=1, max_length=1000)
    before: str = Field(default="", max_length=4096)
    after: str = Field(default="", max_length=4096)


class OverflowContextSlot(AnchorContextSlot):
    reason: Literal["AMBIGUOUS_CONTEXT", "ABSENT_CONTEXT", "CONTEXT_LIMIT"]  # type: ignore[assignment]
