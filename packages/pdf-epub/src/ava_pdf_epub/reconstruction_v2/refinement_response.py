"""The provider can propose relationships and sparse styles, never new source content."""

from ..contracts.common import unique
from .refinement_contract import BookRefinementResponse, BookRefinementTask


def accept_refinement(task: BookRefinementTask, response: BookRefinementResponse) -> None:
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
        raise ValueError("Refinement is stale, incomplete or unresolved")
    unique([d.node_id for d in response.decisions], "refinement decisions")
    unique([e.edge_id for e in response.joins], "refinement joins")
    if {d.node_id for d in response.decisions} != set(task.decision_ids):
        raise ValueError("Refinement decision coverage differs")
    if {e.edge_id for e in response.joins} != {e.id for e in task.edges}:
        raise ValueError("Refinement edge coverage differs")
    nodes = {n.id: n for n in task.nodes}
    order = {n.id: i for i, n in enumerate(task.nodes)}
    crops = {c.id: c.node_id for c in task.crops}
    parts = {(c.node_id, c.part): c.id for c in task.crops}
    for decision in response.decisions:
        node = nodes[decision.node_id]
        unique(decision.evidence_ids, "decision evidence")
        evidence = {crops.get(ident) for ident in decision.evidence_ids}
        required = {parts.get((node.id, "head"))}
        if node.body_reference_id:
            required.add(parts.get((node.body_reference_id, "head")))
        if (
            None in required
            or not required.issubset(decision.evidence_ids)
            or None in evidence
            or node.id not in evidence
            or (node.body_reference_id is not None and node.body_reference_id not in evidence)
            or decision.text_sha256 != node.text_sha256
        ):
            raise ValueError("Refinement evidence or text identity differs")
        if decision.parent_id is not None:
            parent = nodes.get(decision.parent_id)
            if parent is None or parent.kind != "heading" or order[parent.id] >= order[node.id]:
                raise ValueError("Refined parent must be an existing preceding heading")
        if (
            decision.style.id != "observed"
            or decision.style.relative_size is None
            or decision.style.bold is None
        ):
            raise ValueError("Refinement needs observed relative size and explicit weight")
        if node.kind == "paragraph":
            if (
                any(
                    v is not None
                    for v in (
                        decision.heading_level,
                        decision.parent_id,
                        decision.chapter_start,
                        decision.chapter_role,
                    )
                )
                or decision.style.relative_size != 1
            ):
                raise ValueError("Body reference cannot become a heading or change size baseline")
        else:
            if decision.heading_level is None or decision.chapter_start is None:
                raise ValueError("Heading decision incomplete")
            if decision.chapter_start:
                if (
                    decision.heading_level != 1
                    or decision.parent_id is not None
                    or decision.chapter_role is None
                ):
                    raise ValueError("Chapter decision has invalid ancestry")
            elif decision.chapter_role is not None or (
                decision.heading_level > 1 and decision.parent_id is None
            ):
                raise ValueError("Section decision has invalid ancestry")
            if node.ranked_source and (
                decision.heading_level,
                decision.chapter_start,
                decision.chapter_role,
            ) != (node.observed_level, node.observed_chapter, node.observed_role):
                raise ValueError("Refinement conflicts with ranked source evidence")
    edges = {e.id: e for e in task.edges}
    for join in response.joins:
        unique(join.evidence_ids, "join evidence")
        edge = edges[join.edge_id]
        evidence = {crops.get(ident) for ident in join.evidence_ids}
        required = {
            parts.get((edge.previous_id, "tail"), parts.get((edge.previous_id, "head"))),
            parts.get((edge.next_id, "head")),
        }
        if None in required or not required.issubset(join.evidence_ids) or None in evidence:
            raise ValueError("Join requires both source crops")
