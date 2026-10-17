"""A request identifies immutable segment slots; replies contain only boxes."""

from typing import Literal

from pydantic import Field

from ..contracts.common import Digest, Record
from .recognition_fields import RecognitionBox
from .recognition_geometry_prompt import GEOMETRY_CONTEXT_CHARACTERS


class RecognitionGeometrySlot(Record):
    segment_index: int = Field(ge=0, le=1999)
    segment_id: str = Field(min_length=1, max_length=120)
    segment_text_sha256: Digest
    original_box_json: str = Field(min_length=2, max_length=4096)
    original_box_sha256: Digest
    reason: Literal["EMPTY_OR_REVERSED_BOX"]
    kind: Literal[
        "paragraph",
        "heading",
        "quote",
        "aside",
        "caption",
        "credit",
        "verse",
        "code",
        "list_item",
        "note",
        "figure",
        "table",
        "separator",
        "furniture",
        "unsupported",
    ]
    context: str = Field(max_length=GEOMETRY_CONTEXT_CHARACTERS)


class RecognitionGeometryPatch(Record):
    segment_id: str = Field(min_length=1, max_length=120)
    box: RecognitionBox
