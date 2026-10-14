"""Validate complete source-ID decisions; malformed or unresolved output refuses."""

import re
from dataclasses import replace
from typing import overload

from ..contracts.common import unique
from ..contracts.profiles import response_language
from .list_markers import MARKER, marker_value
from .native_structure_contract import NativeStructureResponse, NativeStructureTask
from .native_structure_decision_view import (
    NativeStructureDecisionView,
    native_structure_decision_view,
)
from .native_structure_fields import NativeStructureGroup
from .native_structure_group_order import source_ordered_native_groups
from .native_structure_ornaments import ornamental_separator
from .native_structure_sizes import validate_grouped_sizes
from .native_structure_v2_contract import NativeStructureResponse2, NativeStructureTask2
from .native_structure_versions import AnyNativeStructureResponse, AnyNativeStructureTask


def accept_native_structure(
    task: AnyNativeStructureTask, response: AnyNativeStructureResponse
) -> None:
    canonical_native_structure_response(task, response)


@overload
def canonical_native_structure_response(
    task: NativeStructureTask, response: NativeStructureResponse
) -> NativeStructureResponse: ...


@overload
def canonical_native_structure_response(
    task: NativeStructureTask2, response: NativeStructureResponse2
) -> NativeStructureDecisionView: ...


@overload
def canonical_native_structure_response(
    task: AnyNativeStructureTask, response: AnyNativeStructureResponse
) -> NativeStructureResponse | NativeStructureDecisionView: ...


def canonical_native_structure_response(
    task: AnyNativeStructureTask, response: AnyNativeStructureResponse
) -> NativeStructureResponse | NativeStructureDecisionView:
    """Validate locally; original typed1/2 receipts remain classification authority."""
    decision: NativeStructureResponse | NativeStructureDecisionView
    if isinstance(task, NativeStructureTask2):
        task = NativeStructureTask2.model_validate(task.model_dump())
        validated = NativeStructureResponse2.model_validate(response.model_dump())
        decision = native_structure_decision_view(validated)
    else:
        task = NativeStructureTask.model_validate(task.model_dump())
        decision = NativeStructureResponse.model_validate(response.model_dump())
    return _validate_decisions(task, decision)


def _validate_decisions(
    task: AnyNativeStructureTask, response: NativeStructureResponse | NativeStructureDecisionView
) -> NativeStructureResponse | NativeStructureDecisionView:
    if (
        response.task_id != task.task_id
        or response.source_sha256 != task.source_sha256
        or response.observation_sha256 != task.observation_sha256
        or response.render_sha256 != task.image.sha256
    ):
        raise ValueError("Native structure response belongs to another source/task/render")
    response_language(response.language, task.profile_id)
    if response.unresolved:
        raise ValueError("Native structure response is unresolved")
    unique([g.id for g in response.groups], "native structure group")
    if {g.id for g in response.groups}.intersection(a.id for a in task.artifacts):
        raise ValueError("Native structure group collides with a preserved artifact")
    regions = {r.source.id: r for r in task.regions}
    groups = source_ordered_native_groups(task, response.groups)
    response = (
        replace(response, groups=groups)
        if isinstance(response, NativeStructureDecisionView)
        else response.model_copy(update={"groups": groups})
    )
    lines = {line.id: line for line in task.lines}
    artifacts = {a.id: a for a in task.artifacts}
    for index, group in enumerate(response.groups):
        region = regions[group.region_id]
        if (group.kind == "furniture") != (region.source.role == "furniture"):
            raise ValueError("Native structure cannot invent or reclassify qualified furniture")
        if group.related_to is not None and (
            group.related_to not in artifacts or artifacts[group.related_to].kind != "figure"
        ):
            raise ValueError("Native structure relationship has no preserved source figure")
        first = lines[group.line_ids[0]].text.lstrip()
        if group.kind == "separator" and not ornamental_separator(
            [lines[ident] for ident in group.line_ids],
            width=task.page_width_pt,
            height=task.page_height_pt,
            other_boxes=[line.box for line in task.lines if line.id not in group.line_ids]
            + [r.source.box for r in task.regions if r.artifact_id is not None],
            other_lines=[line for line in task.lines if line.id not in group.line_ids],
        ):
            # A model role cannot authorize canonical omission of ordinary ink.
            raise ValueError("Native structure separator has no source ornamental proof")
        if group.kind == "note":
            _printed_note(group, first)
        if group.kind == "list_item":
            following = response.groups[index + 1] if index + 1 < len(response.groups) else None
            following_text = lines[following.line_ids[0]].text.lstrip() if following else ""
            _printed_marker(group, first, following_text)
        if group.continues_from_previous and group.line_ids[0] != region.line_ids[0]:
            raise ValueError("Native structure continuation is not at its source region start")
        if group.continues_to_next and group.line_ids[-1] != region.line_ids[-1]:
            raise ValueError("Native structure continuation is not at its source region end")
        layout = {
            "align",
            "indent_em",
            "block_indent_em",
            "line_height",
            "space_before_em",
            "space_after_em",
        }
        styles = [lines[ident].style.model_dump(include=layout) for ident in group.line_ids]
        if any(style != styles[0] for style in styles[1:]):
            raise ValueError("Native structure grouping would discard measured block typography")
        validate_grouped_sizes([lines[ident] for ident in group.line_ids])
    _boundaries(task, response)
    _references(task, response)
    return response


def _references(
    task: AnyNativeStructureTask, response: NativeStructureResponse | NativeStructureDecisionView
) -> None:
    unique([r.span_id for r in response.references], "native structure note callout reference")
    eligible = {c.span_id: c for c in task.eligible_callouts}
    owners = {ident: group for group in response.groups for ident in group.line_ids}
    for reference in response.references:
        callout = eligible.get(reference.span_id)
        if callout is None:
            raise ValueError("Native structure reference has no eligible native superscript span")
        group = owners.get(callout.line_id)
        if group is None or group.kind in {"note", "furniture"}:
            raise ValueError("Native structure note callout has no editable source caller")


def _printed_note(group: NativeStructureGroup, text: str) -> None:
    marker = re.match(r"^\[([^]\s]{1,20})\]\s+", text) or re.match(r"^(\d+)\.\s+", text)
    if marker:
        if group.note_label not in {marker[1], marker[0].rstrip()}:
            raise ValueError("Native structure note label conflicts with the printed source")
    elif not re.match(re.escape(group.note_label or "") + r"(?:[.)]\s|\s)", text):
        raise ValueError("Native structure note label is absent from the printed source")


def _printed_marker(group: NativeStructureGroup, text: str, following_text: str) -> None:
    marker, following = MARKER.match(text), MARKER.match(following_text)
    if marker is None:
        raise ValueError("Native structure list marker differs from its printed source")
    start = marker_value(marker["marker"], following["marker"] if following else None)
    if group.list_ordered != (start is not None) or group.list_start != start:
        raise ValueError("Native structure list number differs from its printed source")


def _boundaries(
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
        if left is None or right is None or left.kind != right.kind or left.kind != boundary.role:
            raise ValueError("Native structure layout boundary changes literal/source role")
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
