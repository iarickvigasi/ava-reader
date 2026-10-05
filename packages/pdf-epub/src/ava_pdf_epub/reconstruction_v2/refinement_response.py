"""The provider can propose relationships and sparse styles, never new source content."""

from ..contracts.common import unique
from ..contracts.styles import Style
from .continuation_boundary import JOIN_STYLE
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
    from .bibliographic_refinement import accept_bibliographic_decisions

    accept_bibliographic_decisions(task, response)
    unique([d.node_id for d in response.decisions], "refinement decisions")
    unique([e.edge_id for e in response.joins], "refinement joins")
    if {d.node_id for d in response.decisions} != set(task.decision_ids):
        raise ValueError("Refinement decision coverage differs")
    if {e.edge_id for e in response.joins} != {e.id for e in task.edges}:
        raise ValueError("Refinement edge coverage differs")
    nodes = {n.id: n for n in task.nodes}
    order = {n.id: i for i, n in enumerate(task.nodes)}
    body_references = {n.body_reference_id for n in task.nodes if n.body_reference_id}
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
            if (
                parent is None
                or (parent.kind != "heading" and not parent.structure_candidate)
                or order[parent.id] >= order[node.id]
            ):
                raise ValueError("Refined parent must be an existing preceding heading")
        if node.structure_candidate:
            if node.candidate_original_kind == "heading" and decision.role_kind != "heading":
                raise ValueError("Native heading rank review cannot change the observed role")
            if decision.role_kind is None or (
                decision.role_kind == "list_item" and node.candidate_original_kind != "list_item"
            ):
                raise ValueError("Native role decision is missing or invents a list marker")
            if node.candidate_original_kind == "verse":
                if decision.role_kind not in {"verse", "quote", "paragraph"}:
                    raise ValueError("Literal candidate cannot invent a heading or list marker")
            elif decision.role_kind in {"verse", "quote"}:
                raise ValueError("Only literal candidates can become verse or quote")
            if decision.style is not None:
                raise ValueError("Native role decision cannot change source typography")
        elif decision.role_kind is not None:
            raise ValueError("Only native structure candidates can change role")
        elif decision.style is None:
            raise ValueError("OCR refinement needs observed typography")
        elif decision.style.id != "observed":
            raise ValueError("Refinement needs observed relative size and explicit weight")
        effective_kind = decision.role_kind if node.structure_candidate else node.kind
        if effective_kind != "heading":
            if any(
                v is not None
                for v in (
                    decision.heading_level,
                    decision.parent_id,
                    decision.chapter_start,
                    decision.chapter_role,
                )
            ) or (
                not node.structure_candidate
                and node.id in body_references
                and decision.style is not None
                and decision.style.relative_size != 1
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
    styles = {node.id: node.observed_style for node in task.nodes}
    for decision in response.decisions:
        observed = styles[decision.node_id]
        if nodes[decision.node_id].structure_candidate:
            continue
        values = observed.model_dump() if observed else {"id": "observed"}
        if decision.style is None:
            raise ValueError("OCR refinement needs observed typography")
        values.update(decision.style.model_dump(exclude_none=True))
        styles[decision.node_id] = Style.model_validate(values)
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
        if join.join:
            previous, following = styles[edge.previous_id], styles[edge.next_id]
            if (
                previous is None
                or following is None
                or previous.model_dump(include=JOIN_STYLE)
                != following.model_dump(include=JOIN_STYLE)
            ):
                raise ValueError("Refined join would discard fragment typography")
