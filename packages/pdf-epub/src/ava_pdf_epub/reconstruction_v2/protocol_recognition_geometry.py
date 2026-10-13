"""Opt-in bounded geometry authority; historical Input5 remains closed."""

from typing import Literal

from pydantic import Field, model_validator

from .protocol_native_word_wrap import NativeWordWrapReconstructionInput
from .recognition_geometry_contract import RecognitionGeometryProof


class RecognitionGeometryReconstructionInput(NativeWordWrapReconstructionInput):
    schema_version: Literal["ava-reconstruct-input-6"]  # type: ignore[assignment]
    recognition_repair_policy: Literal["ava-recognition-geometry-repair-1"]
    geometry_corrections: list[RecognitionGeometryProof] = Field(max_length=25000)

    @model_validator(mode="after")
    def geometry_authority(self) -> "RecognitionGeometryReconstructionInput":
        parents = [proof.response.original_task_id for proof in self.geometry_corrections]
        if len(parents) != len(set(parents)) or any(
            proof.response.outcome != "corrected" for proof in self.geometry_corrections
        ):
            raise ValueError("Repeated or unresolved geometry authority")
        if not set(parents) <= {response.task_id for response in self.responses}:
            raise ValueError("Geometry authority lacks its final recognition receipt")
        return self
