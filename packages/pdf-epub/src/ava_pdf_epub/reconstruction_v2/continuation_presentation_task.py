"""Opt-in task construction takes native ownership from private source segments."""

from ..contracts.common import document_digest, text_digest
from .continuation_presentation import uniform_candidate
from .continuation_presentation_contract import PresentationRefinementTask
from .legacy_refinement_contract import BookRefinementTask
from .refinement_identity import refinement_identifier
from .segments import Segment


def presentation_task(
    task: BookRefinementTask, segments: dict[str, Segment], alignment_origins: dict[str, str]
) -> BookRefinementTask | PresentationRefinementTask:
    nodes = {node.id: node for node in task.nodes}
    candidates, native_ids, fallback_ids = [], set(), set()
    for edge in task.edges:
        endpoints = [segments[edge.previous_id], segments[edge.next_id]]
        if {segment.method for segment in endpoints} != {"native", "ocr"}:
            continue
        if any(segment.preserve_line_breaks for segment in endpoints):
            continue  # Literal line layouts need their own join-preservation contract.
        native = next(segment for segment in endpoints if segment.method == "native")
        if native.id in task.decision_ids:
            continue
        for segment in endpoints:
            node = nodes[segment.id]
            if (
                text_digest(segment.text) != node.text_sha256
                or segment.style is None
                or node.observed_style is None
                or document_digest(segment.style) != document_digest(node.observed_style)
            ):
                raise ValueError(
                    "Continuation endpoint changed since source comparison preparation"
                )
        origin = alignment_origins.get(native.id)
        if origin not in {"existing", "centered_source", "fallback_start"}:
            continue
        candidate = uniform_candidate(
            edge,
            nodes[edge.previous_id],
            nodes[edge.next_id],
            native.id,
            native_alignment_fallback=origin == "fallback_start",
        )
        if candidate is not None:
            candidates.append(candidate)
            native_ids.add(native.id)
            if origin == "fallback_start":
                fallback_ids.add(native.id)
    if not candidates:
        return task
    raw = task.model_dump(mode="json")
    raw.update(
        schema_version="ava-book-refinement-task-5",
        prompt_version="ava-book-refinement-8",
        response_schema_version="ava-book-refinement-response-5",
        native_endpoints=sorted(native_ids),
        native_alignment_fallbacks=sorted(fallback_ids),
        join_candidates=[value.model_dump(mode="json") for value in candidates],
    )
    raw["task_id"] = refinement_identifier(raw)
    return PresentationRefinementTask.model_validate(raw)
