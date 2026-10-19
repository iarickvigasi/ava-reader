"""Select unchanged local comparison crops for one ordered decision group."""

from .refinement_catalogue import RefinementCatalogue
from .refinement_contract import RefinementEdge


def refinement_group(
    catalogue: RefinementCatalogue, decisions: list[str], assigned: set[str]
) -> tuple[list[str], list[str], list[RefinementEdge]]:
    nodes = {n.id: n for n in catalogue.nodes}
    order = {n.id: i for i, n in enumerate(catalogue.nodes)}
    headings = [n for n in catalogue.nodes if n.kind == "heading" or n.structure_candidate]
    edges = [
        e
        for e in catalogue.edges
        if e.id not in assigned and (e.previous_id in decisions or e.next_id in decisions)
    ]
    wanted = set(decisions) | {v for e in edges for v in (e.previous_id, e.next_id)}
    for ident in decisions:
        if nodes[ident].kind != "heading" and not nodes[ident].structure_candidate:
            continue
        before = [h for h in headings if order[h.id] < order[ident]]
        after = [h for h in headings if order[h.id] > order[ident]]
        wanted.update(h.id for h in before[-2:] + after[:1])
        chapters = [h for h in before if h.observed_chapter]
        if chapters:
            wanted.add(chapters[-1].id)
    for key in list(wanted):
        reference = nodes[key].body_reference_id
        if reference is not None:
            wanted.add(reference)
    return decisions, [n.id for n in catalogue.nodes if n.id in wanted], edges
