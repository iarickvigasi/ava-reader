"""Validate a finite presentation choice before deriving private compatibility views."""

from dataclasses import dataclass

from ..contracts.common import document_digest
from ..contracts.styles import Style
from .continuation_boundary import JOIN_STYLE
from .continuation_presentation_contract import (
    PresentationRefinementResponse,
    PresentationRefinementTask,
)
from .legacy_refinement_contract import BookRefinementResponse, BookRefinementTask, RefinementStyle
from .refinement_identity import refinement_identifier


@dataclass(frozen=True)
class PresentationProjection:
    task: BookRefinementTask
    response: BookRefinementResponse
    styles: dict[str, Style]
    proof: dict[str, object]


def presentation_projection(
    task: PresentationRefinementTask, response: PresentationRefinementResponse
) -> PresentationProjection:
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
        raise ValueError("Continuation response is stale, incomplete or unresolved")
    candidates = {candidate.edge_id: candidate for candidate in task.join_candidates}
    choices = {choice.edge_id: choice for choice in response.presentations}
    joins = {join.edge_id: join for join in response.joins}
    if (
        len(choices) != len(response.presentations)
        or set(choices) != set(candidates)
        or len(joins) != len(response.joins)
        or set(joins) != {edge.id for edge in task.edges}
    ):
        raise ValueError("Continuation presentation coverage differs")
    parts = {(crop.node_id, crop.part): crop.id for crop in task.crops}
    decisions = {decision.node_id: decision for decision in response.decisions}
    if len(decisions) != len(response.decisions) or set(decisions) != set(task.decision_ids):
        raise ValueError("Continuation decision coverage differs")
    styles: dict[str, Style] = {}
    selected = []
    for edge_id, choice in choices.items():
        candidate = candidates[edge_id]
        if choice.candidate_id is None:
            if choice.evidence_ids:
                raise ValueError("Unselected presentation cannot claim source evidence")
            continue
        required = {
            parts.get((candidate.previous_id, "tail"), parts.get((candidate.previous_id, "head"))),
            parts.get((candidate.next_id, "head")),
        }
        if (
            choice.candidate_id != candidate.id
            or not joins[edge_id].join
            or None in required
            or set(choice.evidence_ids) != required
            or len(choice.evidence_ids) != len(required)
        ):
            raise ValueError("Continuation choice lacks exact endpoint source evidence")
        if styles.keys() & {candidate.previous_id, candidate.next_id}:
            raise ValueError("Overlapping continuation presentation requires chain composition")
        a, b = candidate.previous_style, candidate.next_style
        left, right = a.model_dump(), b.model_dump()
        # New observed fields may fill candidate unknowns, never overwrite known
        # values. A delegated OCR style avoids copying measured decimal metrics.
        for ident, own in ((candidate.previous_id, left), (candidate.next_id, right)):
            patch = decisions.get(ident)
            if patch is None or patch.style is None:
                continue
            for field, value in patch.style.model_dump(exclude={"id"}, exclude_none=True).items():
                if field in {"underline", "strike_through"} and value is True:
                    raise ValueError("Continuation block decoration requires component review")
                current = own.get(field)
                if current is not None and current != value:
                    raise ValueError(
                        "Observed continuation typography conflicts with the selected candidate"
                    )
                if field in JOIN_STYLE - {"space_after_em"}:
                    left[field] = right[field] = value
                elif field in {"indent_em", "space_before_em"}:
                    own[field] = value
                elif field == "space_after_em" and ident == candidate.next_id:
                    left[field] = right[field] = value
        styles[candidate.previous_id] = Style.model_validate(left)
        styles[candidate.next_id] = Style.model_validate(right)
        selected.append(candidate.id)
    projected_nodes = [
        node.model_copy(update={"observed_style": styles[node.id]}) if node.id in styles else node
        for node in task.nodes
    ]
    projected_decisions = []
    nodes = {node.id: node for node in task.nodes}
    for decision in response.decisions:
        values = decision.model_dump(mode="json")
        if decision.node_id in styles:
            if nodes[decision.node_id].structure_candidate or decision.role_kind is not None:
                raise ValueError("Presentation cannot change a native role or observed OCR kind")
            values["style"] = RefinementStyle.model_validate(
                {**styles[decision.node_id].model_dump(mode="json"), "id": "observed"}
            ).model_dump(mode="json")
        projected_decisions.append(values)
    task_raw = task.model_dump(
        mode="json",
        exclude={"join_candidates", "native_endpoints", "native_alignment_fallbacks", "task_id"},
    )
    task_raw.update(
        schema_version="ava-book-refinement-task-3",
        prompt_version="ava-book-refinement-6",
        response_schema_version="ava-book-refinement-response-3",
        nodes=[node.model_dump(mode="json") for node in projected_nodes],
    )
    task_raw["task_id"] = refinement_identifier(task_raw)
    view_task = BookRefinementTask.model_validate(task_raw)
    response_raw = response.model_dump(mode="json", exclude={"presentations"})
    response_raw.update(
        schema_version="ava-book-refinement-response-3",
        task_id=view_task.task_id,
        decisions=projected_decisions,
    )
    view_response = BookRefinementResponse.model_validate(response_raw)
    from .refinement_response import accept_refinement

    accept_refinement(view_task, view_response)
    return PresentationProjection(
        view_task,
        view_response,
        styles,
        dict(
            authority="ava-source-continuation-presentation-1",
            task_id=task.task_id,
            task_sha256=document_digest(task),
            response_sha256=document_digest(response),
            source_sha256=task.source_sha256,
            observation_sha256=task.observation_sha256,
            candidate_ids=selected,
            private_view_task_sha256=document_digest(view_task),
            private_view_response_sha256=document_digest(view_response),
        ),
    )
