"""Source validation is unchanged; version4 adds explicit sparse-stage authority."""

from typing import Literal

from .native_word_wrap_policy import NativeWordWrapPolicy
from .prepared_native_structure import NativeStructurePreparedPage


class NativeWordWrapPreparedPage(NativeStructurePreparedPage):
    # This is a distinct closed Pydantic schema, not an accepted value for Page3.
    schema_version: Literal["ava-prepared-page-4"]  # type: ignore[assignment]
    source_normalization_policy: NativeWordWrapPolicy
