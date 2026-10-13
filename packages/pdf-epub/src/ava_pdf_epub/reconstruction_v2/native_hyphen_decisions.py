"""Retain accepted pair authority until all raw-source links and roles are checked."""

from dataclasses import dataclass

from ..contracts.layout_hyphen import LayoutHyphenCandidate, LayoutHyphenDisposition
from .native_structure_contract import NativeStructureResponse, NativeStructureTask


@dataclass(frozen=True)
class NativeHyphenDecision:
    candidate: LayoutHyphenCandidate
    disposition: LayoutHyphenDisposition
    pair_source: str


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
        )
        for candidate in candidates
    ]
