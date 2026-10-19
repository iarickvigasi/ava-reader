"""Bound comparison crops per group while retaining the full ordered heading catalogue."""

from collections.abc import Callable

from .refinement_capacity import HISTORICAL_REFINEMENT_TASK_LIMIT
from .refinement_catalogue import RefinementCatalogue
from .refinement_contract import RefinementEdge
from .refinement_group import refinement_group


def refinement_groups(
    catalogue: RefinementCatalogue,
    fits: Callable[[list[str]], bool] | None = None,
    *,
    task_limit: int = HISTORICAL_REFINEMENT_TASK_LIMIT,
) -> list[tuple[list[str], list[str], list[RefinementEdge]]]:
    pending = [catalogue.decisions[i : i + 8] for i in range(0, len(catalogue.decisions), 8)]
    assigned: set[str] = set()
    groups: list[tuple[list[str], list[str], list[RefinementEdge]]] = []
    while pending:
        decisions = pending.pop(0)
        _, crop_ids, edges = refinement_group(catalogue, decisions, assigned)
        oversized = (
            len(crop_ids) > 48 or len(edges) > 16 or (fits is not None and not fits(crop_ids))
        )
        if oversized and len(decisions) > 1:
            midpoint = len(decisions) // 2
            pending[:0] = [decisions[:midpoint], decisions[midpoint:]]
            continue
        if oversized or len(groups) >= task_limit:
            raise ValueError("Whole-book refinement groups exceed supported bound")
        groups.append((decisions, crop_ids, edges))
        assigned.update(e.id for e in edges)
    if assigned != {e.id for e in catalogue.edges}:
        raise ValueError("Refinement boundary has no eligible OCR decision")
    return groups
