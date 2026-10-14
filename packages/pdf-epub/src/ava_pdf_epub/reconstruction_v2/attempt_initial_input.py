"""Decode an empty initial attempt without accepting prior provider receipts."""

from .attempt_exchange import strict_json
from .attempt_initial_fields import validate_initial_fields
from .protocol import ReconstructionInput
from .protocol_frontmatter_title import FrontmatterTitleReconstructionInput
from .protocol_native_layout import NativeLayoutReconstructionInput
from .protocol_native_structure import NativeStructureReconstructionInput
from .protocol_native_structure_v2 import NativeStructure2ReconstructionInput
from .protocol_native_word_wrap import NativeWordWrapReconstructionInput
from .protocol_recognition_geometry import RecognitionGeometryReconstructionInput

REQUEST_BYTES = 64 * 1024 * 1024
InitialInput = (
    ReconstructionInput
    | NativeLayoutReconstructionInput
    | NativeStructureReconstructionInput
    | NativeWordWrapReconstructionInput
    | RecognitionGeometryReconstructionInput
    | FrontmatterTitleReconstructionInput
    | NativeStructure2ReconstructionInput
)


def initial_input(data: bytes) -> InitialInput:
    if not 0 < len(data) <= REQUEST_BYTES:
        raise ValueError("Attempt request byte bound exceeded")
    raw = strict_json(data)
    if not isinstance(raw, dict) or set(raw) != {"mode", "input"}:
        raise ValueError("Invalid attempt request fields")
    if raw["mode"] != "attempt_stream" or not isinstance(raw["input"], dict):
        raise ValueError("Invalid attempt request mode/input")
    validate_initial_fields(raw["input"])
    marker = raw["input"].get("schema_version")
    request: InitialInput = (
        NativeStructure2ReconstructionInput.model_validate(raw["input"])
        if marker == "ava-reconstruct-input-8"
        else FrontmatterTitleReconstructionInput.model_validate(raw["input"])
        if marker == "ava-reconstruct-input-7"
        else RecognitionGeometryReconstructionInput.model_validate(raw["input"])
        if marker == "ava-reconstruct-input-6"
        else NativeWordWrapReconstructionInput.model_validate(raw["input"])
        if marker == "ava-reconstruct-input-5"
        else NativeStructureReconstructionInput.model_validate(raw["input"])
        if marker == "ava-reconstruct-input-4"
        else NativeLayoutReconstructionInput.model_validate(raw["input"])
        if marker == "ava-reconstruct-input-3"
        else ReconstructionInput.model_validate(raw["input"])
    )
    if (
        request.responses
        or request.refinements
        or (
            isinstance(
                request, (NativeStructureReconstructionInput, NativeWordWrapReconstructionInput)
            )
            and request.native_structure_responses
        )
        or (isinstance(request, NativeWordWrapReconstructionInput) and request.word_wrap_responses)
        or (
            isinstance(request, RecognitionGeometryReconstructionInput)
            and request.geometry_corrections
        )
        or ("source_feature_policy" in raw["input"] and request.source_feature_policy is None)
    ):
        raise ValueError("Attempt cannot consume prior recognition/refinement/word-wrap decisions")
    return request
