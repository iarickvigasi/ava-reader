"""Project a large book catalogue to bounded requests without dropping global headings."""

from .refinement_catalogue import RefinementCatalogue
from .refinement_catalogue_limits import TASK_NODE_LIMIT
from .refinement_contract import RefinementEdge, RefinementNode


def task_nodes(
    catalogue: RefinementCatalogue,
    decision_ids: list[str],
    crop_ids: list[str],
    edges: list[RefinementEdge],
    *,
    projected: bool,
) -> list[RefinementNode]:
    if not projected or len(catalogue.nodes) <= TASK_NODE_LIMIT:
        return catalogue.nodes
    nodes = {n.id: n for n in catalogue.nodes}
    if len(nodes) != len(catalogue.nodes):
        raise ValueError("Repeated book refinement node identity")
    required = set(decision_ids + crop_ids) | {v for e in edges for v in (e.previous_id, e.next_id)}
    pending = list(required)
    while pending:
        ident = pending.pop()
        if ident not in nodes:
            raise ValueError("Refinement group names a missing source node")
        reference = nodes[ident].body_reference_id
        if reference is not None and reference not in required:
            required.add(reference)
            pending.append(reference)
    included = required | {
        n.id for n in catalogue.nodes if n.kind == "heading" or n.structure_candidate
    }
    if len(included) > TASK_NODE_LIMIT:
        raise ValueError("Whole-book heading and required comparison context exceeds request bound")
    return [
        n
        if n.body_reference_id is None or n.body_reference_id in included
        else n.model_copy(update={"body_reference_id": None})
        for n in catalogue.nodes
        if n.id in included
    ]
