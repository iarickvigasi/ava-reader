"""Reuse the existing safe source-linked essential structure refusal."""

from .source_feature_contract import SourceFeatureRequest
from .source_feature_task_contract import SourceFeatureTask
from .source_refusal import SourceBlockingFinding, SourceContentRefusal, SourceRefusalDiagnostic


def refuse_feature(task: SourceFeatureTask, request: SourceFeatureRequest) -> None:
    crop = next(
        c
        for c in task.crops
        if c.request_node_id == request.node_id and c.node_id == request.node_id
    )
    raise SourceContentRefusal(
        SourceRefusalDiagnostic(
            source_sha256=task.source_sha256,
            stage="assembly",
            findings=[
                SourceBlockingFinding(
                    code="ESSENTIAL_STRUCTURE_UNSUPPORTED",
                    page=request.page,
                    box=request.source_box,
                    region_box=request.column_box,
                    block_id=request.node_id,
                    task_id=task.task_id,
                    render_sha256=crop.render_sha256,
                )
            ],
        )
    )
