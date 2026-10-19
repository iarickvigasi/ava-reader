"""Partition only current role tasks; the ordinary historical refinement engine stays closed."""

from ..contracts.common import document_digest
from .assembly_state import AssemblyState
from .continuation_presentation_contract import POLICY
from .printed_title_v2_contract import FrontmatterTitleResponse, FrontmatterTitleTask
from .refinement_contract import AnyRefinementResponse, AnyRefinementTask
from .segments import Segment
from .source_role_contract import SourceRoleResponse, SourceRoleTask
from .source_role_response import accept_source_role


def source_role_application(
    segments: list[Segment],
    tasks: list[AnyRefinementTask | FrontmatterTitleTask | SourceRoleTask],
    responses: list[AnyRefinementResponse | FrontmatterTitleResponse | SourceRoleResponse],
    state: AssemblyState,
) -> tuple[
    list[AnyRefinementTask | FrontmatterTitleTask],
    list[AnyRefinementResponse | FrontmatterTitleResponse],
    list[SourceRoleTask],
    dict[str, SourceRoleResponse],
]:
    receipts = {r.task_id: r for r in responses}
    owners = {s.id: s for s in segments}
    role_tasks, role_receipts, ordinary, ordinary_receipts = [], {}, [], []
    for task in tasks:
        response = receipts[task.task_id]
        if isinstance(task, SourceRoleTask):
            if state.source_continuation_policy != POLICY or not isinstance(
                response, SourceRoleResponse
            ):
                raise ValueError("Source role requires current task/response/policy authority")
            accept_source_role(task, response)
            if any(
                n.id not in owners or document_digest(owners[n.id]) != n.owner_sha256
                for n in task.nodes
            ):
                raise ValueError("Source role original owner differs")
            role_tasks.append(task)
            role_receipts[task.task_id] = response
        else:
            if isinstance(response, SourceRoleResponse):
                raise ValueError("Historical refinement cannot consume source role authority")
            ordinary.append(task)
            ordinary_receipts.append(response)
    return ordinary, ordinary_receipts, role_tasks, role_receipts
