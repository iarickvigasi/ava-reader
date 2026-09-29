"""Bound comparison crops per group while retaining the full ordered heading catalogue."""

from collections.abc import Callable

from .refinement_catalogue import RefinementCatalogue
from .refinement_contract import RefinementEdge


def refinement_groups(
    catalogue: RefinementCatalogue,
    fits: Callable[[list[str]], bool] | None = None,
) -> list[tuple[list[str], list[str], list[RefinementEdge]]]:
    nodes = {n.id: n for n in catalogue.nodes}
    order = {n.id: i for i, n in enumerate(catalogue.nodes)}
    headings = [n for n in catalogue.nodes if n.kind == "heading"]
    pending = [catalogue.decisions[i : i + 8] for i in range(0, len(catalogue.decisions), 8)]
    assigned: set[str] = set()
    groups: list[tuple[list[str], list[str], list[RefinementEdge]]] = []
    while pending:
        decisions = pending.pop(0)
        edges = [
            e
            for e in catalogue.edges
            if e.id not in assigned and (e.previous_id in decisions or e.next_id in decisions)
        ]
        wanted = set(decisions) | {v for e in edges for v in (e.previous_id, e.next_id)}
        for ident in decisions:
            if nodes[ident].kind != "heading":
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
        crop_ids = [n.id for n in catalogue.nodes if n.id in wanted]
        oversized = len(wanted) > 48 or len(edges) > 16 or (fits is not None and not fits(crop_ids))
        if oversized and len(decisions) > 1:
            midpoint = len(decisions) // 2
            pending[:0] = [decisions[:midpoint], decisions[midpoint:]]
            continue
        if oversized or len(groups) >= 32:
            raise ValueError("Whole-book refinement groups exceed supported bound")
        groups.append((decisions, crop_ids, edges))
        assigned.update(e.id for e in edges)
    if assigned != {e.id for e in catalogue.edges}:
        raise ValueError("Refinement boundary has no eligible OCR decision")
    return groups
