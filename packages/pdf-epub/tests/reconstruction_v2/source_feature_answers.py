"""Independent authored finite responses; no runtime imports this fixture helper."""

from ava_pdf_epub.reconstruction_v2.refinement_identity import refinement_identifier
from ava_pdf_epub.reconstruction_v2.source_feature_task_contract import (
    SourceFeatureResponse,
    SourceFeatureTask,
)


def decisions(task, overrides=None):
    overrides = overrides or {}
    nodes = {n.id: n for n in task.nodes}
    answer = []
    values = {
        "family": "sans-serif",
        "weight": False,
        "italic": False,
        "relative_size": 1.0,
        "first_line_indent": 0.0,
        "block_inset": 0.0,
    }
    for request in task.source_features:
        features = []
        for feature in request.requested_features:
            value = (
                ("quote" if request.node_id == "quoted" else "paragraph")
                if feature == "paragraph_role"
                else 1.6
                if feature == "relative_size" and request.node_id == "heading"
                else values[feature]
            )
            obs = dict(
                feature=feature,
                disposition="observed",
                value=value,
                reason=None,
                evidence_ids=[c.id for c in task.crops if c.request_node_id == request.node_id],
            )
            obs.update(overrides.get((request.node_id, feature), {}))
            features.append(obs)
        answer.append(
            dict(
                node_id=request.node_id,
                text_sha256=nodes[request.node_id].text_sha256,
                features=features,
            )
        )
    return SourceFeatureResponse.model_validate(
        dict(
            schema_version="ava-book-refinement-response-4",
            task_id=task.task_id,
            source_sha256=task.source_sha256,
            observation_sha256=task.observation_sha256,
            image_sha256=task.image.sha256,
            decisions=[],
            joins=[],
            unresolved=[],
            feature_decisions=answer,
        )
    )


def remake(task, **changes):
    raw = task.model_dump(mode="json")
    raw.update(changes)
    raw["task_id"] = refinement_identifier(raw)
    return SourceFeatureTask.model_validate(raw)
