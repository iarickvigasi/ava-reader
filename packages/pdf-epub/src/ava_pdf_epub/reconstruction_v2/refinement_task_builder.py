"""Build one source-bound request with deterministic identity and unchanged schema."""

from typing import Any

from .refinement_catalogue import RefinementCatalogue
from .refinement_context import RefinementContext
from .refinement_contract import BookRefinementTask
from .refinement_identity import refinement_identifier
from .refinement_sheet import refinement_sheet
from .refinement_task_groups import RefinementGroup
from .refinement_task_nodes import task_nodes


def build_refinement_task(
    catalogue: RefinementCatalogue, group: RefinementGroup, context: RefinementContext
) -> BookRefinementTask:
    decisions, crop_ids, edges, metadata_ids = group
    if metadata_ids:
        pages = {context.segments[ident].page for ident in metadata_ids}
        nodes = [
            n
            for n in catalogue.metadata_nodes
            if n.id in metadata_ids
            or (n.kind == "heading" and min(pages) - 2 <= n.page <= max(pages))
        ]
    else:
        nodes = task_nodes(catalogue, decisions, crop_ids, edges, projected=context.projected_nodes)
    crops, image = refinement_sheet(
        crop_ids, context.segments, context.pages, context.scratch, context.tail_ids
    )
    raw: dict[str, Any] = dict(
        schema_version="ava-book-refinement-task-3",
        source_sha256=context.source_sha256,
        observation_sha256=context.observation_sha256,
        profile_id=context.profile_id,
        prompt_version="ava-book-refinement-4" if metadata_ids else context.structure_prompt,
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
    task = BookRefinementTask.model_validate(raw)
    if context.continuation_policy and edges:
        from .continuation_presentation_task import presentation_task

        task = presentation_task(task, context.segments, context.alignment_origins)
    return task
