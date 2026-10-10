"""Stable content identity and image bounds; no execution credentials in refinement tasks."""

import base64
import hashlib
import io
import json
from typing import TYPE_CHECKING

from PIL import Image

from ..contracts.common import unique

if TYPE_CHECKING:
    from .refinement_contract import AnyRefinementTask


def refinement_identifier(value: dict[str, object]) -> str:
    raw = dict(value)
    raw.pop("task_id", None)
    image = raw["image"]
    if not isinstance(image, dict):
        raise ValueError("Invalid refinement image")
    raw["image"] = {key: item for key, item in image.items() if key != "base64"}
    return (
        "refine-"
        + hashlib.sha256(
            json.dumps(raw, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
        ).hexdigest()
    )


def validate_refinement_task(task: "AnyRefinementTask") -> None:
    if task.task_id != refinement_identifier(task.model_dump(mode="json")):
        raise ValueError("Refinement task identity mismatch")
    for values, label in [
        ([n.id for n in task.nodes], "nodes"),
        (task.decision_ids, "decisions"),
        (task.metadata_ids, "metadata decisions"),
        ([c.id for c in task.crops], "crops"),
        ([e.id for e in task.edges], "edges"),
    ]:
        unique(values, label)
    if any(
        n.structure_candidate != (n.candidate_original_kind is not None)
        or (n.structure_candidate and (n.ranked_source or n.observed_style is None))
        for n in task.nodes
    ):
        raise ValueError("Native structure candidate lacks immutable role/style observations")
    if any(
        n.candidate_original_kind == "heading"
        and (
            n.kind != "heading"
            or n.observed_level is None
            or (n.id in task.decision_ids and task.prompt_version != "ava-book-refinement-6")
        )
        for n in task.nodes
    ):
        raise ValueError("Native heading rank review requires its versioned heading contract")
    from .source_feature_task_contract import SourceFeatureTask

    if isinstance(task, SourceFeatureTask):
        from .source_feature_identity import validate_source_feature_task

        validate_source_feature_task(task)
    if not task.decision_ids and not task.metadata_ids and not isinstance(task, SourceFeatureTask):
        raise ValueError("Refinement task has no decisions")
    if task.metadata_ids and task.prompt_version != "ava-book-refinement-4":
        raise ValueError("Bibliographic decisions require the contextual metadata prompt")
    nodes = {n.id for n in task.nodes}
    unique(
        [getattr(c, "request_node_id", "") + ":" + c.node_id + ":" + c.part for c in task.crops],
        "crop parts",
    )
    page_by_node = {n.id: n.page for n in task.nodes}
    if any(
        c.page != page_by_node.get(c.node_id)
        or c.source_box.coordinate_space != "page_points_top_left"
        for c in task.crops
    ):
        raise ValueError("Refinement crop source page differs")
    if not set(task.decision_ids + task.metadata_ids).issubset(nodes):
        raise ValueError("Refinement decisions outside catalogue")
    if any(n.body_reference_id and n.body_reference_id not in nodes for n in task.nodes):
        raise ValueError("Refinement body reference absent")
    if any(c.node_id not in nodes for c in task.crops):
        raise ValueError("Refinement crop outside catalogue")
    if any(e.previous_id not in nodes or e.next_id not in nodes for e in task.edges):
        raise ValueError("Refinement edge outside catalogue")
    image = base64.b64decode(task.image.base64, validate=True)
    if (
        len(image) != task.image.byte_length
        or hashlib.sha256(image).hexdigest() != task.image.sha256
    ):
        raise ValueError("Refinement image identity mismatch")
    if len(image) > 4 * 1024**2 or max(task.image.width, task.image.height) > 2048:
        raise ValueError("Refinement image exceeds limits")
    with Image.open(io.BytesIO(image)) as opened:
        opened.verify()
    with Image.open(io.BytesIO(image)) as opened:
        if opened.format != "PNG" or opened.size != (task.image.width, task.image.height):
            raise ValueError("Refinement image format or dimensions differ")
        if getattr(opened, "n_frames", 1) != 1 or opened.getexif().get(274, 1) != 1:
            raise ValueError("Refinement image is not a single upright frame")
        opened.load()
    for crop in task.crops:
        x0, y0, x1, y1 = crop.image_box
        if not (0 <= x0 < x1 <= task.image.width and 0 <= y0 < y1 <= task.image.height):
            raise ValueError("Refinement crop outside contact sheet")
