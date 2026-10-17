"""A structural marker cut records exact source bytes; it is never a spelling decision."""

import re
from typing import Literal

from pydantic import Field, model_validator

from .common import Digest, Id, Record, text_digest

HORIZONTAL = r"[ \t\u00a0\u2007\u202f]"


class PrefixCutReceipt(Record):
    line_id: Id
    raw_prefix: str = Field(min_length=1, max_length=1000)
    raw_prefix_sha256: Digest
    original_line_sha256: Digest
    role: Literal["note", "list_item"]
    label: str = Field(min_length=1, max_length=100)
    marker_text: str = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def exact_marker(self) -> "PrefixCutReceipt":
        if text_digest(self.raw_prefix) != self.raw_prefix_sha256:
            raise ValueError("Structural prefix digest differs")
        if (
            re.fullmatch(
                HORIZONTAL + "*" + re.escape(self.marker_text) + HORIZONTAL + "+", self.raw_prefix
            )
            is None
        ):
            raise ValueError("Structural cut must be only its printed marker and horizontal layout")
        if self.marker_text.strip("[]().") != self.label:
            raise ValueError("Structural cut label differs from its exact printed marker")
        if self.role == "note":
            allowed = self.marker_text in {
                self.label,
                f"[{self.label}]",
                f"{self.label}.",
                f"{self.label})",
            }
        else:
            allowed = re.fullmatch(r"(?:\(?[\w]+[.)]|[•◦▪‣*–—-])", self.marker_text) is not None
        if not allowed:
            raise ValueError("Structural cut has no supported note/list marker")
        return self


class LayoutSourceCut(Record):
    source_start: int = Field(ge=0, le=200000)
    source_end: int = Field(gt=0, le=200000)
    receipt: PrefixCutReceipt
