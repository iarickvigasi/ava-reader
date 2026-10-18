"""Build immutable source-order comparison records and separate metadata context."""

import hashlib
from collections.abc import Mapping

from .refinement_contract import RefinementNode
from .segments import Segment


def catalogue_nodes(
    segments: list[Segment],
    included: set[str],
    metadata_ids: list[str],
    references: Mapping[str, Segment],
    unranked: set[str | None],
) -> tuple[list[RefinementNode], list[RefinementNode]]:
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
    return nodes, metadata_nodes
