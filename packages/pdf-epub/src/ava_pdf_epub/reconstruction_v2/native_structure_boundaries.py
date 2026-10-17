"""Retain original boundary receipts; changed roles need final-owner word-wrap proof."""

from ..contracts.common import unique
from .native_structure_contract import NativeStructureResponse
from .native_structure_decision_view import NativeStructureDecisionView
from .native_structure_v2_contract import NativeStructureTask2
from .native_structure_versions import AnyNativeStructureTask


def validate_native_boundaries(
    task: AnyNativeStructureTask, response: NativeStructureResponse | NativeStructureDecisionView
) -> None:
    unique([d.candidate_id for d in response.boundary_dispositions], "native boundary disposition")
    boundaries = {b.candidate_id: b for b in task.boundaries}
    if {d.candidate_id for d in response.boundary_dispositions} != set(boundaries):
        raise ValueError("Native structure boundary disposition coverage differs")
    owners = {ident: group for group in response.groups for ident in group.line_ids}
    for disposition in response.boundary_dispositions:
        boundary = boundaries[disposition.candidate_id]
        if disposition.candidate_sha256 != boundary.candidate_sha256:
            raise ValueError("Native structure boundary candidate identity differs")
        if disposition.disposition == "unresolved":
            raise ValueError("Native structure source boundary is unresolved")
        if disposition.disposition != "layout":
            continue
        left, right = owners.get(boundary.left_line_id), owners.get(boundary.right_line_id)
        if left is None or right is None or left.kind != right.kind:
            raise ValueError("Native structure layout boundary changes literal/source role")
        if left.kind != boundary.role and not (
            isinstance(task, NativeStructureTask2)
            and left is right
            and boundary.role == "paragraph"
            and left.kind in {"list_item", "note"}
        ):
            raise ValueError("Native structure layout boundary changes literal/source role")
        # Native2 requires final-owner word-wrap qualification. Its catalogue will
        # request fresh authority rather than reuse this provisional paragraph
        # receipt after a role change or a printed-prefix cut.
        if left is right:
            index = left.line_ids.index(boundary.left_line_id)
            if left.line_ids[index + 1 : index + 2] != [boundary.right_line_id]:
                raise ValueError("Native structure layout boundary is not adjacent source prose")
        else:
            position = response.groups.index(left)
            region_order = [r.source.id for r in task.regions]
            if not (
                left.continues_to_next
                and right.continues_from_previous
                and response.groups[position + 1 : position + 2] == [right]
                and left.line_ids[-1] == boundary.left_line_id
                and right.line_ids[0] == boundary.right_line_id
                and region_order.index(right.region_id) == region_order.index(left.region_id) + 1
            ):
                raise ValueError("Native structure layout boundary requires confirmed continuation")
