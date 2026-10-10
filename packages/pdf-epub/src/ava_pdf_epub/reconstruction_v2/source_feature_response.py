"""Exact per-feature evidence coverage; optional appearance uncertainty never invents values."""

from typing import TYPE_CHECKING

from ..contracts.common import unique
from ..contracts.styles import Style

if TYPE_CHECKING:
    from .source_feature_task_contract import SourceFeatureResponse, SourceFeatureTask

STYLE_FEATURES = {
    "family": "family",
    "weight": "bold",
    "italic": "italic",
    "first_line_indent": "indent_em",
    "block_inset": "block_indent_em",
    "relative_size": "relative_size",
}


def accept_source_features(task: "SourceFeatureTask", response: "SourceFeatureResponse") -> None:
    if response.decisions or response.joins or response.metadata_decisions:
        raise ValueError("Finite feature decisions cannot change ancestry, joins or metadata")
    requests = {q.node_id: q for q in task.source_features}
    nodes = {n.id: n for n in task.nodes}
    unique([d.node_id for d in response.feature_decisions], "feature decisions")
    if {d.node_id for d in response.feature_decisions} != set(requests):
        raise ValueError("Feature decision coverage differs")
    for decision in response.feature_decisions:
        request, node = requests[decision.node_id], nodes[decision.node_id]
        if decision.text_sha256 != node.text_sha256:
            raise ValueError("Feature immutable text identity differs")
        unique([f.feature for f in decision.features], "feature dispositions")
        if {f.feature for f in decision.features} != set(request.requested_features):
            raise ValueError("Requested feature disposition coverage differs")
        required = {c.id for c in task.crops if c.request_node_id == node.id}
        for feature in decision.features:
            unique(feature.evidence_ids, "feature evidence")
            if set(feature.evidence_ids) != required:
                raise ValueError(
                    "Feature evidence must cover its exact local source/reference crops"
                )
            if feature.disposition == "unknown":
                if feature.value is not None or feature.reason not in {
                    "source_blurred",
                    "source_clipped",
                    "source_context_insufficient",
                }:
                    raise ValueError("Unknown feature cannot manufacture an observed value")
                if feature.feature == "paragraph_role":
                    from .source_feature_refusal import refuse_feature

                    refuse_feature(task, request)
            elif feature.disposition == "not_applicable":
                if (
                    feature.feature != "first_line_indent"
                    or node.kind != "heading"
                    or feature.value is not None
                    or feature.reason != "heading_has_no_prose_first_line"
                ):
                    raise ValueError(
                        "Feature non-applicability is not supported by its host-observed role"
                    )
            elif feature.reason is not None or feature.value is None:
                raise ValueError("Observed feature needs a value and no uncertainty reason")
            elif feature.feature == "paragraph_role":
                if feature.value not in request.allowed_roles:
                    raise ValueError("Feature role transition is outside paragraph/quote authority")
            else:
                field = STYLE_FEATURES[feature.feature]
                if field in {"bold", "italic"} and type(feature.value) is not bool:
                    raise ValueError("Observed weight/italic needs an explicit boolean")
                if field in {"indent_em", "block_indent_em", "relative_size"} and type(
                    feature.value
                ) not in {int, float}:
                    raise ValueError("Observed source geometry needs a finite number")
                Style.model_validate({"id": "observed", field: feature.value})
