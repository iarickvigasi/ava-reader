"""Use the existing total batch budget; record optional uninspected appearances honestly."""

import hashlib
from collections.abc import Sequence
from pathlib import Path

from .assembly_state import AssemblyState
from .page_checkpoints import PreparedPageMap
from .prepared import PreparedPage
from .refinement_digest import observation_digest
from .refinement_identity import refinement_identifier
from .segments import Segment
from .source_feature_contract import FEATURE_POLICY, SourceFeatureRequest
from .source_feature_selection import MAX_FEATURE_DECISIONS, source_feature_selection
from .source_feature_sheet import feature_sheet_fits, source_feature_sheet
from .source_feature_task_contract import SourceFeatureTask
from .source_feature_uninspected import uninspected_appearance, uninspected_feature


def source_feature_tasks(
    source: Path,
    scratch: Path,
    prepared: Sequence[PreparedPage],
    segments: list[Segment],
    state: AssemblyState,
    existing_tasks: int,
) -> list[SourceFeatureTask]:
    state.source_feature_policy = FEATURE_POLICY
    pages, segment_map = PreparedPageMap(prepared), {s.id: s for s in segments}
    requests, nodes, missing_context = source_feature_selection(segments, pages, state)
    digest, source_sha = (
        observation_digest(segments),
        hashlib.sha256(source.read_bytes()).hexdigest(),
    )
    state.requested_source_features = sum(len(q.requested_features) for q in requests) + 4 * len(
        missing_context
    )
    for segment in missing_context:
        uninspected_appearance(
            segment,
            ["family", "weight", "italic", "relative_size"],
            "source_context_unavailable",
            source_sha,
            digest,
            state,
        )
    groups: list[list[SourceFeatureRequest]] = []
    current: list[SourceFeatureRequest] = []
    for index, request in enumerate(requests):
        can_fit = feature_sheet_fits([request], segment_map, pages)
        if index >= MAX_FEATURE_DECISIONS or not can_fit:
            if request.allowed_roles:
                from .source_refusal import refuse_segment

                refuse_segment(pages[request.page], segment_map[request.node_id])
            uninspected_feature(request, segment_map[request.node_id], source_sha, digest, state)
            continue
        if current and not feature_sheet_fits([*current, request], segment_map, pages):
            groups.append(current)
            current = []
        current.append(request)
    if current:
        groups.append(current)
    tasks: list[SourceFeatureTask] = []
    for group in groups:
        if existing_tasks + len(tasks) >= 32:
            for request in group:
                if request.allowed_roles:
                    from .source_refusal import refuse_segment

                    refuse_segment(pages[request.page], segment_map[request.node_id])
                uninspected_feature(
                    request, segment_map[request.node_id], source_sha, digest, state
                )
            continue
        crops, image = source_feature_sheet(group, segment_map, pages, scratch)
        ids = {q.node_id for q in group} | {i for q in group for i in q.reference_ids}
        raw = dict(
            schema_version="ava-book-refinement-task-4",
            source_sha256=source_sha,
            observation_sha256=digest,
            profile_id=prepared[0].profile_id,
            prompt_version="ava-book-refinement-7",
            response_schema_version="ava-book-refinement-response-4",
            nodes=[n.model_dump(mode="json") for n in nodes.values() if n.id in ids],
            pixels_per_point=2,
            decision_ids=[],
            edges=[],
            source_features=[q.model_dump(mode="json") for q in group],
            crops=[c.model_dump(mode="json") for c in crops],
            image=image.model_dump(mode="json"),
        )
        raw["task_id"] = refinement_identifier(raw)
        tasks.append(SourceFeatureTask.model_validate(raw))
    return tasks
