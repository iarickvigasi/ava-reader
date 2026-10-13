"""Replay original bytes and exact box patches against immutable prepared tasks."""

from collections.abc import Sequence

from .prepared_types import AnyPreparedPage
from .protocol_recognition_geometry import RecognitionGeometryReconstructionInput
from .recognition_contract import RecognitionResponse, RecognitionTask
from .recognition_geometry_repair import apply_geometry_repair, prepare_geometry_repair


def validate_geometry_proofs(
    prepared: Sequence[AnyPreparedPage], request: RecognitionGeometryReconstructionInput
) -> None:
    pending = {proof.response.original_task_id: proof for proof in request.geometry_corrections}
    if not pending:
        return
    responses = {response.task_id: response for response in request.responses}
    # Retain only the current source page's images, preserving the checkpoint cache bound.
    for page in prepared:
        for task in page.tasks:
            proof = pending.pop(task.task_id, None)
            if proof is None:
                continue
            final = responses.get(task.task_id)
            if not isinstance(task, RecognitionTask) or final is None:
                raise ValueError("GEOMETRY_PROOF_PARENT_DIFFERS")
            correction = prepare_geometry_repair(task, proof.original_response_json)
            patched = apply_geometry_repair(task, correction, proof.response)
            if RecognitionResponse.model_validate(patched) != final:
                raise ValueError("GEOMETRY_PROOF_FINAL_RESPONSE_DIFFERS")
        if not pending:
            return
    raise ValueError("GEOMETRY_PROOF_PARENT_DIFFERS")
