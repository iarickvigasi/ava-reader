"""Role-only authority never supplies text, typography, relationships or index receipts."""

import hashlib

from ..contracts.common import unique
from .source_role_contract import SourceRoleResponse, SourceRoleTask


def accept_source_role(task: SourceRoleTask, response: SourceRoleResponse) -> None:
    if (
        response.task_id,
        response.source_sha256,
        response.observation_sha256,
        response.image_sha256,
    ) != (
        task.task_id,
        task.source_sha256,
        task.observation_sha256,
        task.image.sha256,
    ) or response.unresolved:
        raise ValueError("Source role response is stale or unresolved")
    unique([d.node_id for d in response.role_decisions], "source role decisions")
    nodes = {n.id: n for n in task.nodes}
    if {d.node_id for d in response.role_decisions} != set(nodes):
        raise ValueError("Source role decision coverage differs")
    for decision in response.role_decisions:
        node = nodes[decision.node_id]
        required = {c.id for c in task.crops if c.part == "page" or c.node_id == node.id}
        unique(decision.evidence_ids, "source role evidence")
        if decision.text_sha256 != node.text_sha256 or set(decision.evidence_ids) != required:
            raise ValueError("Source role text or exact evidence differs")
        if decision.role is None:
            if decision.reason is None:
                raise ValueError("Unknown source role requires a reason")
            from .source_refusal import (
                SourceBlockingFinding,
                SourceContentRefusal,
                SourceRefusalDiagnostic,
            )

            raise SourceContentRefusal(
                SourceRefusalDiagnostic(
                    source_sha256=task.source_sha256,
                    stage="assembly",
                    findings=[
                        SourceBlockingFinding(
                            code="ESSENTIAL_STRUCTURE_UNSUPPORTED",
                            page=task.page,
                            box=node.source_box,
                            region_box=next(c.source_box for c in task.crops if c.part == "page"),
                            block_id=node.id,
                            segment_id_sha256=hashlib.sha256(node.id.encode()).hexdigest(),
                            task_id=task.task_id,
                            render_sha256=task.crops[0].render_sha256,
                        )
                    ],
                )
            )
        if decision.reason is not None:
            raise ValueError("Observed source role cannot retain uncertainty")
