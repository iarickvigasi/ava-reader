"""Choose source-backed comparisons without copying body prose into every model task."""

import hashlib
from dataclasses import dataclass, field

from .assembly_state import AssemblyState
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
    segments: list[Segment], state: AssemblyState, *, include_bibliography: bool = False
) -> RefinementCatalogue:
    from .bibliographic_refinement import bibliographic_candidates

    metadata_ids = bibliographic_candidates(segments) if include_bibliography else []
    unranked = {f.block_id for f in state.structure_findings}
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
    nodes, metadata_nodes = [], []
    metadata_pages = {s.page for s in segments if s.id in metadata_ids}
    for index, segment in enumerate(segments):
        metadata_context = segment.id in metadata_ids or bool(
            metadata_pages
            and segment.kind == "heading"
            and min(metadata_pages) - 2 <= segment.page <= max(metadata_pages)
        )
        if segment.id not in included and not metadata_context:
            continue
        if (
            segment.kind not in {"heading", "paragraph", "credit"}
            and not segment.structure_candidate
        ):
            raise ValueError("Refinement catalogue contains unsupported kind")
        reference = references.get(segment.id)
        node = RefinementNode(
            id=segment.id,
            page=segment.page,
            kind="heading" if segment.kind == "heading" else "paragraph",
            candidate_original_kind=(
                "heading"
                if segment.kind == "heading"
                else "list_item"
                if segment.kind == "list_item"
                else ("verse" if segment.kind == "verse" else "paragraph")
            )
            if segment.structure_candidate
            else None,
            structure_candidate=segment.structure_candidate,
            context_before=segments[index - 1].text[-200:]
            if segment.structure_candidate and index
            else "",
            context_after=segments[index + 1].text[:200]
            if segment.structure_candidate and index + 1 < len(segments)
            else "",
            text_sha256=hashlib.sha256(segment.text.encode()).hexdigest(),
            text_excerpt=segment.text[:500],
            observed_level=segment.heading_level,
            observed_chapter=segment.chapter_start,
            observed_role=segment.chapter_role,
            observed_style=segment.style,
            ranked_source=segment.id not in unranked and not segment.structure_candidate,
            body_reference_id=reference.id if reference else None,
        )
        if segment.id in included:
            nodes.append(node)
        if metadata_context:
            metadata_nodes.append(node.model_copy(update={"body_reference_id": None}))
    if len(nodes) > 256:
        raise ValueError("Whole-book refinement catalogue exceeds supported bound")
    return RefinementCatalogue(
        nodes, [s.id for s in segments if s.id in selected], edges, metadata_ids, metadata_nodes
    )
