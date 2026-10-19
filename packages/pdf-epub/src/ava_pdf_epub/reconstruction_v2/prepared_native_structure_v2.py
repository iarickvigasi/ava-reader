"""Closed checkpoint5 retains all source proofs under current Native2 authority."""

from typing import Literal

from pydantic import Field

from .native_structure_policy import NativeStructurePolicy2
from .native_structure_v2_contract import NativeStructureTask2
from .prepared_native_word_wrap import NativeWordWrapPreparedPage
from .recognition_contract import RecognitionTask


class NativeStructure2PreparedPage(NativeWordWrapPreparedPage):
    schema_version: Literal["ava-prepared-page-5"]  # type: ignore[assignment]
    source_structure_policy: NativeStructurePolicy2  # type: ignore[assignment]
    tasks: list[RecognitionTask | NativeStructureTask2] = Field(  # type: ignore[assignment]
        max_length=50
    )
