"""Deterministically bind book-level decisions to the original qualified page observations."""

import hashlib
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from ..contracts.profiles import BILINGUAL_PROFILE
from .assembly_state import AssemblyState
from .page_checkpoints import PreparedPageMap
from .prepared import PreparedPage
from .refinement_catalogue import refinement_catalogue
from .refinement_contract import BookRefinementTask, RefinementEdge
from .refinement_digest import observation_digest
from .refinement_groups import refinement_groups
from .refinement_identity import refinement_identifier
from .refinement_prompt import MIXED_HIERARCHY_PROMPT_VERSION, REFINEMENT_PROMPT_VERSION
from .refinement_sheet import refinement_sheet
from .refinement_sheet_bounds import sheet_fits
from .segments import Segment


def prepare_refinement(
    source: Path,
    scratch: Path,
    prepared: Sequence[PreparedPage],
    segments: list[Segment],
    state: AssemblyState,
) -> list[BookRefinementTask]:
    catalogue = refinement_catalogue(
        segments, state, include_bibliography=prepared[0].profile_id == BILINGUAL_PROFILE
    )
    if not catalogue.decisions and not catalogue.metadata_ids:
        return []
    structure_prompt = (
        MIXED_HIERARCHY_PROMPT_VERSION
        if any(n.candidate_original_kind == "heading" for n in catalogue.nodes)
        else REFINEMENT_PROMPT_VERSION
    )
    digest = observation_digest(segments)
    source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
    segment_map, page_map = {s.id: s for s in segments}, PreparedPageMap(prepared)
    tail_ids = {e.previous_id for e in catalogue.edges}
    tasks = []
    groups: list[tuple[list[str], list[str], list[RefinementEdge], list[str]]] = [
        (decisions, crop_ids, edges, [])
        for decisions, crop_ids, edges in refinement_groups(
            catalogue, lambda ids: sheet_fits(ids, segment_map, page_map, tail_ids)
        )
    ]
    from .bibliographic_refinement import metadata_crop_groups

    anchors = [n.id for n in catalogue.metadata_nodes if n.kind == "heading"][:1]
    for ids in metadata_crop_groups(
        catalogue.metadata_ids,
        lambda ids: sheet_fits(list(dict.fromkeys([*anchors, *ids])), segment_map, page_map, set()),
    ):
        groups.append(([], list(dict.fromkeys([*anchors, *ids])), [], ids))
    for decisions, crop_ids, edges, metadata_ids in groups:
        nodes = catalogue.nodes
        if metadata_ids:
            # Metadata roles need title-page context, not every heading in a long book.
            pages = {segment_map[ident].page for ident in metadata_ids}
            nodes = [
                n
                for n in catalogue.metadata_nodes
                if n.id in metadata_ids
                or (n.kind == "heading" and min(pages) - 2 <= n.page <= max(pages))
            ]
        crops, image = refinement_sheet(crop_ids, segment_map, page_map, scratch, tail_ids)
        raw: dict[str, Any] = dict(
            schema_version="ava-book-refinement-task-3",
            source_sha256=source_sha,
            observation_sha256=digest,
            profile_id=prepared[0].profile_id,
            prompt_version="ava-book-refinement-4" if metadata_ids else structure_prompt,
            response_schema_version="ava-book-refinement-response-3",
            nodes=[n.model_dump(mode="json") for n in nodes],
            pixels_per_point=2,
            decision_ids=decisions,
            edges=[e.model_dump(mode="json") for e in edges],
            crops=[c.model_dump(mode="json") for c in crops],
            image=image.model_dump(mode="json"),
        )
        if metadata_ids:
            raw["metadata_ids"] = metadata_ids
        raw["task_id"] = refinement_identifier(raw)
        tasks.append(BookRefinementTask.model_validate(raw))
    if len(tasks) > 32:
        raise ValueError("Too many refinement tasks")
    return tasks
