"""Private, source-bound page checkpoints; never reader or publication content."""

from typing import Literal

from pydantic import Field

from ..contracts.common import Digest, Record
from .observations import PageObservation
from .observe_tables import TableObservation
from .recognition_contract import RecognitionTask
from .segments import Segment


class PreparedPage(Record):
    schema_version: Literal["ava-prepared-page-1"]
    source_sha256: Digest
    source_byte_length: int = Field(ge=1, le=52428800)
    source_page_count: int = Field(ge=1, le=500)
    observation: PageObservation
    tables: list[TableObservation] = Field(max_length=100)
    native_segments: list[Segment] = Field(max_length=2000)
    tasks: list[RecognitionTask] = Field(max_length=50)
