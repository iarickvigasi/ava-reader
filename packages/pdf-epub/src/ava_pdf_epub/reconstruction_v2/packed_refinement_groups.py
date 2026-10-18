"""Fit the largest ordered prefix without shrinking crops or discarding local evidence."""

from collections.abc import Callable

from .refinement_catalogue import RefinementCatalogue
from .refinement_contract import RefinementEdge
from .refinement_group import refinement_group


def packed_refinement_groups(
    catalogue: RefinementCatalogue, fits: Callable[[list[str]], bool]
) -> list[tuple[list[str], list[str], list[RefinementEdge]]]:
    assigned: set[str] = set()
    groups: list[tuple[list[str], list[str], list[RefinementEdge]]] = []
    offset = 0
    while offset < len(catalogue.decisions):
        for size in range(min(8, len(catalogue.decisions) - offset), 0, -1):
            group = refinement_group(
                catalogue, catalogue.decisions[offset : offset + size], assigned
            )
            _, crops, edges = group
            if len(crops) <= 48 and len(edges) <= 16 and fits(crops):
                break
        else:
            raise ValueError("Whole-book refinement group cannot fit readable source context")
        if len(groups) >= 32:
            raise ValueError("Whole-book refinement groups exceed supported bound")
        groups.append(group)
        assigned.update(e.id for e in edges)
        offset += size
    if assigned != {e.id for e in catalogue.edges}:
        raise ValueError("Refinement boundary has no eligible OCR decision")
    return groups
