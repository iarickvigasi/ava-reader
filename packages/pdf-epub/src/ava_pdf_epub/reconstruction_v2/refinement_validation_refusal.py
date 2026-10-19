"""Finite semantic-guard evidence; not source, style or publication authority."""

import hashlib
from typing import Literal

from pydantic import Field

from ..contracts.common import Digest, Record
from .legacy_refinement_contract import BookRefinementTask, RefinementNode

Check = Literal["non_heading_ancestry", "body_reference_size_baseline"]


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class RefinementValidationFinding(Record):
    kind: Literal["refinement"] = "refinement"
    code: Literal["REFINEMENT_ROLE_BASELINE_INVALID"] = "REFINEMENT_ROLE_BASELINE_INVALID"
    stage: Literal["refinement"] = "refinement"
    check: Check
    task_id_sha256: Digest
    node_id_sha256: Digest
    observation_sha256: Digest
    render_sha256: Digest
    page: int = Field(ge=1, le=500)


class RefinementValidationRefusal(ValueError):
    def __init__(self, task: BookRefinementTask, node: RefinementNode, check: Check) -> None:
        # Preserve the existing exception category and public failure message.
        super().__init__("Body reference cannot become a heading or change size baseline")
        self.source_sha256 = task.source_sha256
        self.node_text_sha256 = node.text_sha256
        self.finding = RefinementValidationFinding(
            check=check,
            task_id_sha256=_digest(task.task_id),
            node_id_sha256=_digest(node.id),
            observation_sha256=task.observation_sha256,
            render_sha256=task.image.sha256,
            page=node.page,
        )

    def bind_task(self, task: BookRefinementTask) -> None:
        # A Task5 private Task3 compatibility view must retain the original task identity.
        f = self.finding
        node = next((n for n in task.nodes if _digest(n.id) == f.node_id_sha256), None)
        if (
            task.source_sha256 != self.source_sha256
            or task.observation_sha256 != f.observation_sha256
            or task.image.sha256 != f.render_sha256
            or node is None
            or node.page != f.page
            or node.text_sha256 != self.node_text_sha256
        ):
            return
        self.finding = f.model_copy(update={"task_id_sha256": _digest(task.task_id)})
