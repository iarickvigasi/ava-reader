"""Compile the existing private prepared-page version and announce its exact source maps."""

from typing import TYPE_CHECKING

from ..worker_observation import observe
from .native_colour_witness import make_witness
from .native_line_offsets import mapped_native_ids, native_line_offsets
from .prepared import PreparedPage
from .prepared_native_layout import NativeLayoutPreparedPage
from .prepared_types import AnyPreparedPage
from .source_preparation import SourcePreparation

if TYPE_CHECKING:
    from .native_colour_capture import ColourCapture


def compile_prepared_page(
    preparation: SourcePreparation, prepared: PreparedPage, capture: "ColourCapture | None"
) -> AnyPreparedPage:
    observation, segments = prepared.observation, prepared.native_segments
    if preparation.source_layout_policy is not None:
        prepared_native = NativeLayoutPreparedPage.model_validate(
            {
                **prepared.model_dump(),
                "schema_version": "ava-prepared-page-2",
                "source_layout_policy": preparation.source_layout_policy,
                "native_line_maps": [
                    m.model_dump()
                    for m in native_line_offsets(observation, segments, mapped_native_ids(segments))
                ],
                **(
                    {
                        "native_colour_witness": make_witness(
                            preparation, observation, segments, capture
                        ).model_dump()
                    }
                    if capture is not None and capture.valid and capture.raw_glyph_sha256
                    else {}
                ),
            }
        )
        observe("page", prepared_native)
        return prepared_native
    observe("page", prepared)
    return prepared
