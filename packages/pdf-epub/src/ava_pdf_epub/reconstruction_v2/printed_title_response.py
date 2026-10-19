"""Only the dispatched complete heading and its own source crops can establish a title."""

from .printed_title_contract import PrintedTitleResponse, PrintedTitleTask


def accept_printed_title(task: PrintedTitleTask, response: PrintedTitleResponse) -> None:
    task = PrintedTitleTask.model_validate(task.model_dump())
    response = PrintedTitleResponse.model_validate(response.model_dump())
    if (
        response.task_id,
        response.source_sha256,
        response.observation_sha256,
        response.image_sha256,
        response.decision.node_id,
        response.decision.text_sha256,
    ) != (
        task.task_id,
        task.source_sha256,
        task.observation_sha256,
        task.image.sha256,
        task.node.id,
        task.node.text_sha256,
    ):
        raise ValueError("Printed title source/task/text identity differs")
    ids = response.decision.evidence_ids
    if len(set(ids)) != len(ids) or set(ids) != {crop.id for crop in task.crops}:
        raise ValueError("Printed title requires its own complete title/context crops")
