"""Versioned feature authority is separate from historical native/chapter decisions."""

from typing import TYPE_CHECKING

from ..contracts.common import unique
from .source_feature_geometry import feature_dimensions

if TYPE_CHECKING:
    from .source_feature_task_contract import SourceFeatureTask


def validate_source_feature_task(task: "SourceFeatureTask") -> None:
    if (
        task.prompt_version != "ava-book-refinement-7"
        or task.response_schema_version != "ava-book-refinement-response-4"
        or not task.source_features
        or task.decision_ids
        or task.metadata_ids
        or task.edges
    ):
        raise ValueError("Feature task must have exclusively finite source-feature authority")
    nodes = {n.id: n for n in task.nodes}
    unique([q.node_id for q in task.source_features], "feature requests")
    for request in task.source_features:
        node = nodes.get(request.node_id)
        if (
            node is None
            or node.page != request.page
            or node.structure_candidate
            or node.observation_method != "ocr"
            or node.source_box != request.source_box
            or node.text_length is None
        ):
            raise ValueError("Feature request lacks an immutable OCR node")
        unique(list[str](request.requested_features), "requested features")
        unique(request.reference_ids, "feature references")
        if request.node_id in request.reference_ids or any(
            i not in nodes or nodes[i].page != request.page for i in request.reference_ids
        ):
            raise ValueError("Feature references must be distinct source-local nodes")
        if request.allowed_roles != (
            ["paragraph", "quote"] if "paragraph_role" in request.requested_features else []
        ) or (request.allowed_roles and node.kind not in {"paragraph", "quote"}):
            raise ValueError("Feature role authority differs")
        a, b = request.source_box, request.column_box
        if (
            a.coordinate_space != "page_points_top_left"
            or a.coordinate_space != b.coordinate_space
            or not (b.x0 <= a.x0 < a.x1 <= b.x1 and b.y0 <= a.y0 < a.y1 <= b.y1)
        ):
            raise ValueError("Feature source region is outside its column context")
        selected = [c for c in task.crops if c.request_node_id == request.node_id]
        if {c.node_id for c in selected} != {request.node_id, *request.reference_ids}:
            raise ValueError("Feature crop coverage differs")
        for crop in selected:
            if crop.part != "context" or crop.page != request.page:
                raise ValueError("Feature crop source scope differs")
            observed = nodes[crop.node_id].source_box
            if observed is None or not (
                crop.source_box.x0 <= observed.x0 < observed.x1 <= crop.source_box.x1
                and crop.source_box.y0 <= observed.y0 < observed.y1 <= crop.source_box.y1
            ):
                raise ValueError("Feature crop must retain each complete observed line group")
            overlap = min(a.x1, observed.x1) - max(a.x0, observed.x0)
            if (
                crop.node_id != node.id
                and overlap < min(a.x1 - a.x0, observed.x1 - observed.x0) * 0.8
            ):
                raise ValueError("Feature reference crosses a source column")
            w, h = feature_dimensions(crop.source_box)
            x0, y0, x1, y1 = crop.image_box
            if (
                (x1 - x0, y1 - y0) != (w, h)
                or crop.source_box.x0 != b.x0
                or crop.source_box.x1 != b.x1
            ):
                raise ValueError("Feature crop loses physical scale or body-column margin")
    if any(c.request_node_id not in {q.node_id for q in task.source_features} for c in task.crops):
        raise ValueError("Feature crop is outside requested scope")
