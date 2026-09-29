"""Apply source-bound structure-only decisions to copies, retaining original observations."""

from ..contracts.common import document_digest
from .assembly_state import AssemblyState
from .refinement_contract import BookRefinementResponse, BookRefinementTask
from .refinement_digest import observation_digest
from .refinement_graph import validate_refined_graph
from .refinement_joins import refined_boundaries
from .refinement_response import accept_refinement
from .segments import Segment


def apply_refinement(
    segments: list[Segment],
    tasks: list[BookRefinementTask],
    responses: list[BookRefinementResponse],
    state: AssemblyState,
) -> list[Segment]:
    if any(t.observation_sha256 != observation_digest(segments) for t in tasks):
        raise ValueError("Refinement observation identity differs")
    receipts = {r.task_id: r for r in responses}
    if len(receipts) != len(responses) or set(receipts) != {t.task_id for t in tasks}:
        raise ValueError("Refinement task coverage differs")
    updates, parents, edges = {}, {}, {}
    evidence = []
    for task in tasks:
        response = receipts[task.task_id]
        accept_refinement(task, response)
        for decision in response.decisions:
            if decision.node_id in updates:
                raise ValueError("Repeated refinement decision")
            updates[decision.node_id] = decision
            parents[decision.node_id] = decision.parent_id
        edge_map = {e.id: e for e in task.edges}
        for join in response.joins:
            edge = edge_map[join.edge_id]
            edges[(edge.previous_id, edge.next_id)] = join.join
        evidence.append(
            dict(
                task_sha256=document_digest(task),
                response_sha256=document_digest(response),
                observation_sha256=task.observation_sha256,
                task_id=task.task_id,
                node_ids=[d.node_id for d in response.decisions],
            )
        )
    result = []
    for segment in segments:
        patch = updates.get(segment.id)
        if patch:
            if segment.method != "ocr":
                raise ValueError("Refinement cannot override native source observations")
            style = segment.style.model_dump() if segment.style else {"id": "observed"}
            style.update(patch.style.model_dump(exclude_none=True))
            values = segment.model_dump()
            values["style"] = style
            if segment.kind == "heading":
                values.update(
                    heading_level=patch.heading_level,
                    chapter_start=patch.chapter_start,
                    chapter_role=patch.chapter_role,
                )
            segment = Segment.model_validate(values)
        result.append(segment)
    validate_refined_graph(result, parents)
    result = refined_boundaries(result, edges)
    state.refined_joins.update(edges)
    state.refinement_evidence.extend(evidence)
    state.structure_findings = [f for f in state.structure_findings if f.block_id not in updates]
    return result
