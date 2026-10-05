"""Unspent optional comparisons stay unknown with source identity, never fake crop receipts."""

import hashlib
from typing import Literal

from .assembly_state import AssemblyState
from .segments import Segment
from .source_feature_contract import Feature, SourceFeatureRequest


def uninspected_feature(
    request: SourceFeatureRequest,
    segment: Segment,
    source_sha: str,
    digest: str,
    state: AssemblyState,
) -> None:
    uninspected_appearance(
        segment, request.requested_features, "comparison_budget_bound", source_sha, digest, state
    )


def uninspected_appearance(
    segment: Segment,
    features: list[Feature],
    reason: Literal["comparison_budget_bound", "source_context_unavailable"],
    source_sha: str,
    digest: str,
    state: AssemblyState,
) -> None:
    for feature in features:
        state.source_feature_evidence.append(
            dict(
                node_id=segment.id,
                page=segment.page,
                box=segment.box.model_dump(mode="json"),
                text_sha256=hashlib.sha256(segment.text.encode()).hexdigest(),
                text_length=len(segment.text),
                feature=feature,
                disposition="unknown",
                value=None,
                reason=reason,
                task_id=None,
                task_sha256=None,
                response_sha256=None,
                observation_sha256=digest,
                source_sha256=source_sha,
                crop_ids=[],
                crop_sha256=None,
            )
        )
