"""Extended comparison groups omit remote context pointers, never required source references."""

from typing import Any

from .source_feature_contract import SourceFeatureRequest
from .source_feature_selection import MAX_FEATURE_DECISIONS
from .source_feature_task_contract import SourceFeatureNode


def feature_group_nodes(
    group: list[SourceFeatureRequest], nodes: dict[str, SourceFeatureNode], decision_limit: int
) -> list[dict[str, Any]]:
    requested = {q.node_id for q in group}
    included = requested | {i for q in group for i in q.reference_ids}
    result = []
    for node in nodes.values():
        if node.id not in included:
            continue
        if (
            decision_limit > MAX_FEATURE_DECISIONS
            and node.body_reference_id is not None
            and node.body_reference_id not in included
        ):
            if node.id in requested:
                raise ValueError("Required feature body reference is outside its group")
            node = node.model_copy(update={"body_reference_id": None})
        result.append(node.model_dump(mode="json"))
    return result
