"""Project only validated complete provider decisions into private normalization authority."""

from ..contracts.common import document_digest
from ..contracts.layout_hyphen_classification_v3 import LayoutHyphenClassificationReceipt
from ..contracts.layout_hyphen_v3 import candidate_digest_v2
from .word_wrap_contract import WordWrapResponse, WordWrapTask
from .word_wrap_response import validate_word_wrap_response


def word_wrap_classifications(
    task: WordWrapTask,
    response: WordWrapResponse,
) -> list[LayoutHyphenClassificationReceipt]:
    validate_word_wrap_response(task, response)
    return [
        LayoutHyphenClassificationReceipt(
            authority="word_wrap",
            task_id=task.task_id,
            task_sha256=document_digest(task),
            response_sha256=document_digest(response),
            catalogue_sha256=task.catalogue_sha256,
            candidate_id=entry.candidate.id,
            source_candidate_sha256=candidate_digest_v2(entry.candidate),
            decision=decision.disposition,
        )
        for entry, decision in zip(task.entries, response.decisions, strict=True)
    ]
