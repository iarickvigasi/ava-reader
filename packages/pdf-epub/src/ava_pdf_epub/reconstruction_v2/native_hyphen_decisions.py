"""Retain accepted pair authority until all raw-source links and roles are checked."""

from dataclasses import dataclass

from ..contracts.common import document_digest
from ..contracts.layout_hyphen import (
    LayoutHyphenCandidate,
    LayoutHyphenDisposition,
    candidate_digest,
)
from ..contracts.layout_hyphen_classification_v3 import NativeStructureHyphenClassificationReceipt
from .native_structure_contract import NativeStructureResponse, NativeStructureTask


@dataclass(frozen=True)
class NativeHyphenDecision:
    candidate: LayoutHyphenCandidate
    disposition: LayoutHyphenDisposition
    pair_source: str
    classification: NativeStructureHyphenClassificationReceipt | None = None


def retained_hyphen_decisions(
    task: NativeStructureTask,
    response: NativeStructureResponse,
    candidates: list[LayoutHyphenCandidate],
) -> list[NativeHyphenDecision]:
    lines = {line.id: line.text for line in task.lines}
    decisions = {d.candidate_id: d for d in response.boundary_dispositions}
    return [
        NativeHyphenDecision(
            candidate,
            decisions[candidate.id],
            lines[candidate.left.line_id] + "\n" + lines[candidate.right.line_id],
            NativeStructureHyphenClassificationReceipt(
                authority="native_structure",
                task_id=task.task_id,
                task_sha256=document_digest(task),
                response_sha256=document_digest(response),
                candidate_id=candidate.id,
                source_candidate_sha256=candidate_digest(candidate),
                decision=decisions[candidate.id].disposition,
                original_candidate=candidate,
            ),
        )
        for candidate in candidates
    ]
