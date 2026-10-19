"""Every stage reconstructs fresh typed models from raw source-bound response receipts."""

from typing import Any

from .attempt_initial_input import REQUEST_BYTES, InitialInput
from .protocol import AnyReconstructionInput, reconstruction_input
from .protocol_native_layout import NativeLayoutReconstructionInput
from .protocol_native_structure import NativeStructureReconstructionInput
from .protocol_native_word_wrap import NativeWordWrapReconstructionInput
from .protocol_recognition_geometry import RecognitionGeometryReconstructionInput


def attempt_complete_input(
    initial: InitialInput,
    responses: list[Any],
    refinements: list[Any],
    native_responses: list[Any] | None = None,
    word_wrap_responses: list[Any] | None = None,
    geometry_corrections: list[Any] | None = None,
) -> AnyReconstructionInput:
    from .protocol_output import encode_packet

    raw = {**initial.model_dump(mode="json"), "responses": responses, "refinements": refinements}
    if isinstance(initial, (NativeStructureReconstructionInput, NativeWordWrapReconstructionInput)):
        raw["native_structure_responses"] = native_responses or []
    if isinstance(initial, NativeWordWrapReconstructionInput):
        raw["word_wrap_responses"] = word_wrap_responses or []
    if isinstance(initial, RecognitionGeometryReconstructionInput):
        raw["geometry_corrections"] = geometry_corrections or []
    if not isinstance(
        initial,
        (
            NativeLayoutReconstructionInput,
            NativeStructureReconstructionInput,
            NativeWordWrapReconstructionInput,
        ),
    ) and any(
        isinstance(r, dict) and r.get("schema_version") == "ava-printed-title-response-1"
        for r in refinements
    ):
        raw["schema_version"] = "ava-reconstruct-input-2"
    encode_packet({"mode": "reconstruct_stream", "input": raw}, REQUEST_BYTES)
    return reconstruction_input(raw)
