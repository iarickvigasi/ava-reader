"""Explicit cell geometry authority on the current feature stack; Input8 stays closed."""

from typing import Literal

from pydantic import Field

from .protocol_native_structure_v2 import NativeStructure2ReconstructionInput
from .recognition_cell_geometry_contract import RecognitionCellGeometryProof
from .recognition_geometry_contract import RecognitionGeometryProof


class CellGeometryReconstructionInput(NativeStructure2ReconstructionInput):
    schema_version: Literal["ava-reconstruct-input-9"]  # type: ignore[assignment]
    recognition_repair_policy: Literal["ava-recognition-geometry-repair-2"]  # type: ignore[assignment]
    geometry_corrections: list[RecognitionGeometryProof | RecognitionCellGeometryProof] = Field(  # type: ignore[assignment]
        max_length=25000
    )
    # Inherited geometry_authority enforces one proof per parent across both kinds,
    # corrected-only dispositions and an existing final recognition response.
