"""Choose source-backed comparisons without copying body prose into every model task."""

from dataclasses import dataclass, field

from .assembly_state import AssemblyState
from .refinement_catalogue_limits import catalogue_limit
from .refinement_catalogue_nodes import catalogue_nodes
from .refinement_contract import RefinementEdge, RefinementNode
from .refinement_edges import refinement_edges
from .segments import Segment


@dataclass
class RefinementCatalogue:
    nodes: list[RefinementNode]
    decisions: list[str]
    edges: list[RefinementEdge]
    metadata_ids: list[str] = field(default_factory=list)
    metadata_nodes: list[RefinementNode] = field(default_factory=list)


def refinement_catalogue(
    segments: list[Segment],
    state: AssemblyState,
    *,
    include_bibliography: bool = False,
    source_author: str | None = None,
    source_title_policy: str | None = None,
) -> RefinementCatalogue:
    from .bibliographic_refinement import bibliographic_candidates

    metadata_ids = (
        bibliographic_candidates(segments, source_author, source_title_policy=source_title_policy)
        if include_bibliography
        else []
    )
    unranked = {f.block_id for f in state.structure_findings if f.severity != "information"}
    headings = [s for s in segments if s.kind == "heading" or s.structure_candidate]
    prose = [
        s
        for s in segments
        if s.kind == "paragraph"
        and not s.structure_candidate
        and len(s.text) >= 80
        and (not s.style or s.style.align in {None, "start", "left", "justify"})
    ]
    wanted = [
        s
        for s in headings
        if s.structure_candidate
        or (
            s.method == "ocr"
            and (
                s.id in unranked
                or not s.style
                or s.style.relative_size is None
                or s.style.bold is None
            )
        )
    ]
    edges = refinement_edges(segments, state)
    if not wanted and not edges and not metadata_ids:
        return RefinementCatalogue([], [], [])
    if wanted and not prose:
        raise ValueError("Source refinement requires an observed body reference")
    references = {
        s.id: min(prose, key=lambda p: (abs(p.page - s.page), abs(p.box.y0 - s.box.y0)))
        for s in wanted
    }
    selected = {s.id for s in wanted} | {s.id for s in references.values() if s.method == "ocr"}
    included = {s.id for s in headings} | {s.id for s in references.values()}
    endpoints = {v for edge in edges for v in (edge.previous_id, edge.next_id)}
    included.update(endpoints)
    if not wanted and not edges:
        included.clear()
    selected.update(s.id for s in segments if s.id in endpoints and s.method == "ocr")
    nodes, metadata_nodes = catalogue_nodes(segments, included, metadata_ids, references, unranked)
    if len(nodes) > catalogue_limit(state, source_title_policy):
        raise ValueError("Whole-book refinement catalogue exceeds supported bound")
    return RefinementCatalogue(
        nodes, [s.id for s in segments if s.id in selected], edges, metadata_ids, metadata_nodes
    )
