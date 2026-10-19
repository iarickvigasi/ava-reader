"""Apply only the separately accepted role; all original content and styles stay fixed."""

import hashlib
import json

from ..contracts.common import document_digest
from .assembly_state import AssemblyState
from .continuation_presentation_contract import POLICY
from .segments import Segment
from .source_role_contract import SourceRoleResponse, SourceRoleTask
from .source_role_response import accept_source_role


def apply_source_roles(
    segments: list[Segment],
    tasks: list[SourceRoleTask],
    receipts: dict[str, SourceRoleResponse],
    state: AssemblyState,
) -> list[Segment]:
    if tasks and state.source_continuation_policy != POLICY:
        raise ValueError("Source role requires captured current policy")
    owners = {s.id: s for s in segments}
    applied = set()
    for task in tasks:
        response = receipts[task.task_id]
        accept_source_role(task, response)
        nodes = {n.id: n for n in task.nodes}
        for decision in response.role_decisions:
            owner = owners[decision.node_id]
            if (
                owner.id in applied
                or owner.method != "ocr"
                or document_digest(owner) != nodes[owner.id].owner_sha256
            ):
                raise ValueError("Source role owner changed or overlaps another correction")
            applied.add(owner.id)
            owners[owner.id] = owner.model_copy(update={"kind": decision.role})
            state.source_feature_evidence.append(
                dict(
                    node_id=owner.id,
                    page=owner.page,
                    box=owner.box.model_dump(mode="json"),
                    text_sha256=decision.text_sha256,
                    text_length=len(owner.text),
                    feature="paragraph_role",
                    disposition="observed",
                    value=decision.role,
                    reason=None,
                    task_id=task.task_id,
                    task_sha256=document_digest(task),
                    response_sha256=document_digest(response),
                    observation_sha256=task.observation_sha256,
                    source_sha256=task.source_sha256,
                    crop_ids=decision.evidence_ids,
                    crop_sha256=hashlib.sha256(
                        json.dumps(
                            [
                                c.model_dump(mode="json")
                                for c in task.crops
                                if c.id in decision.evidence_ids
                            ],
                            sort_keys=True,
                            separators=(",", ":"),
                        ).encode()
                    ).hexdigest(),
                )
            )
    return [owners[s.id] for s in segments]
