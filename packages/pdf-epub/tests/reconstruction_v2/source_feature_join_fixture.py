"""Controlled legacy join task against the same untouched finite-feature observations."""

from ava_pdf_epub.reconstruction_v2.refinement_contract import (
    BookRefinementResponse,
    BookRefinementTask,
    RefinementNode,
)
from ava_pdf_epub.reconstruction_v2.refinement_identity import refinement_identifier


def join_fixture(feature_task, join):
    ids = {"quoted", "body"}
    nodes = []
    for n in feature_task.nodes:
        if n.id not in ids:
            continue
        nodes.append(
            {
                k: v
                for k, v in n.model_dump(mode="json").items()
                if k not in {"source_box", "text_length", "observation_method"}
            }
        )
    nodes = [RefinementNode.model_validate(n).model_dump(mode="json") for n in nodes]
    crops = []
    for c in feature_task.crops:
        if c.request_node_id != "quoted":
            continue
        raw = c.model_dump(mode="json")
        raw.pop("request_node_id")
        raw["part"] = "head"
        crops.append(raw)
    raw = dict(
        schema_version="ava-book-refinement-task-3",
        source_sha256=feature_task.source_sha256,
        observation_sha256=feature_task.observation_sha256,
        profile_id=feature_task.profile_id,
        prompt_version="ava-book-refinement-5",
        response_schema_version="ava-book-refinement-response-3",
        nodes=nodes,
        pixels_per_point=2,
        decision_ids=["body"],
        edges=[dict(id="boundary", previous_id="quoted", next_id="body")],
        crops=crops,
        image=feature_task.image.model_dump(mode="json"),
    )
    raw["task_id"] = refinement_identifier(raw)
    task = BookRefinementTask.model_validate(raw)
    node = next(n for n in task.nodes if n.id == "body")
    response = BookRefinementResponse.model_validate(
        dict(
            schema_version="ava-book-refinement-response-3",
            task_id=task.task_id,
            source_sha256=task.source_sha256,
            observation_sha256=task.observation_sha256,
            image_sha256=task.image.sha256,
            decisions=[
                dict(
                    node_id="body",
                    text_sha256=node.text_sha256,
                    evidence_ids=[next(c.id for c in task.crops if c.node_id == "body")],
                    heading_level=None,
                    parent_id=None,
                    chapter_start=None,
                    chapter_role=None,
                    style=dict(id="observed", relative_size=1, bold=False),
                )
            ],
            joins=[dict(edge_id="boundary", join=join, evidence_ids=[c.id for c in task.crops])],
            unresolved=[],
        )
    )
    return task, response
