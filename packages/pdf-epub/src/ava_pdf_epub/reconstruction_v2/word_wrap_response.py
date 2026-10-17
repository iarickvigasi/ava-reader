"""Exact ordered ID decisions cannot borrow another source, snapshot or catalogue."""

from ..contracts.common import unique
from .word_wrap_contract import WordWrapResponse, WordWrapTask


def validate_word_wrap_response(task: WordWrapTask, response: WordWrapResponse) -> None:
    task = WordWrapTask.model_validate(task.model_dump())
    response = WordWrapResponse.model_validate(response.model_dump())
    if (
        response.task_id != task.task_id
        or response.source_sha256 != task.source_sha256
        or response.observation_sha256 != task.observation_sha256
        or response.catalogue_sha256 != task.catalogue_sha256
    ):
        raise ValueError("Word-wrap response belongs to another source/task/catalogue")
    unique([decision.id for decision in response.decisions], "word-wrap response decision")
    if [decision.id for decision in response.decisions] != [entry.id for entry in task.entries]:
        raise ValueError("Word-wrap response must cover every entry in exact catalogue order")
    if any(decision.disposition == "unresolved" for decision in response.decisions):
        raise ValueError("Essential native word-wrap decision remains unresolved")
