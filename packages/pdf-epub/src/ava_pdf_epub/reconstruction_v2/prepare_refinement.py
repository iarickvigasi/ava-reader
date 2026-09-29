"""Deterministically bind book-level decisions to the original qualified page observations."""

import hashlib
from pathlib import Path

from .assembly_state import AssemblyState
from .prepared import PreparedPage
from .refinement_catalogue import refinement_catalogue
from .refinement_contract import BookRefinementTask
from .refinement_digest import observation_digest
from .refinement_groups import refinement_groups
from .refinement_identity import refinement_identifier
from .refinement_sheet import refinement_sheet
from .refinement_sheet_bounds import sheet_fits
from .segments import Segment


def prepare_refinement(
    source: Path,
    scratch: Path,
    prepared: list[PreparedPage],
    segments: list[Segment],
    state: AssemblyState,
) -> list[BookRefinementTask]:
    catalogue = refinement_catalogue(segments, state)
    if not catalogue.decisions:
        return []
    digest = observation_digest(segments)
    source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
    segment_map, page_map = {s.id: s for s in segments}, {p.observation.number: p for p in prepared}
    tail_ids = {e.previous_id for e in catalogue.edges}
    tasks = []
    for decisions, crop_ids, edges in refinement_groups(
        catalogue, lambda ids: sheet_fits(ids, segment_map, page_map, tail_ids)
    ):
        crops, image = refinement_sheet(crop_ids, segment_map, page_map, scratch, tail_ids)
        raw = dict(
            schema_version="ava-book-refinement-task-1",
            source_sha256=source_sha,
            observation_sha256=digest,
            profile_id="ava-pdf-prose-en-v2",
            prompt_version="ava-book-refinement-1",
            response_schema_version="ava-book-refinement-response-1",
            nodes=[n.model_dump(mode="json") for n in catalogue.nodes],
            pixels_per_point=2,
            decision_ids=decisions,
            edges=[e.model_dump(mode="json") for e in edges],
            crops=[c.model_dump(mode="json") for c in crops],
            image=image.model_dump(mode="json"),
        )
        raw["task_id"] = refinement_identifier(raw)
        tasks.append(BookRefinementTask.model_validate(raw))
    if len(tasks) > 32:
        raise ValueError("Too many refinement tasks")
    return tasks
