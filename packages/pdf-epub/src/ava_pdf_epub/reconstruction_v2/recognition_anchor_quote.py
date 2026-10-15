"""One bounded quotation repair preserves the immutable parent and every non-anchor field."""

import copy
from typing import Any

from .attempt_exchange import json_bytes, strict_json
from .recognition_anchor_candidates import allowed_quotations
from .recognition_anchor_context import digest
from .recognition_anchor_eligibility import REASONS, eligible_anchor_response
from .recognition_anchor_quote_contract import (
    ANCHOR_QUOTE_PROMPT_VERSION,
    AnchorQuoteSlot,
    RecognitionAnchorQuoteResponse,
    RecognitionAnchorQuoteTask,
    quote_task_id,
)
from .recognition_anchors import RecognitionTextAnchor, anchored_offsets
from .recognition_contract import RecognitionTask
from .validate_tasks import validate_tasks


def prepare_anchor_quote(
    task: RecognitionTask, original_response_json: str
) -> RecognitionAnchorQuoteTask:
    task = RecognitionTask.model_validate(task.model_dump())
    response, failed = eligible_anchor_response(task, original_response_json)
    slots = []
    for index in sorted(failed):
        segment = response["segments"][index]
        for span_index, span in enumerate(segment["spans"]):
            anchor = RecognitionTextAnchor.model_validate(span.get("anchor"))
            try:
                anchored_offsets(segment["text"], anchor)
            except ValueError as error:
                reason = REASONS.get(str(error))
                candidates = allowed_quotations(segment["text"], span)
                if reason is None or not candidates:
                    raise ValueError("ANCHOR_QUOTE_NOT_ELIGIBLE") from None
                span_json = json_bytes(span).decode()
                slots.append(
                    AnchorQuoteSlot(
                        segment_index=index,
                        segment_id=segment["id"],
                        segment_text_sha256=digest(segment["text"].encode()),
                        span_index=span_index,
                        original_span_json=span_json,
                        span_sha256=digest(span_json.encode()),
                        reason=reason,
                        allowed_quotations=candidates,
                    )
                )
    fields: dict[str, Any] = dict(
        schema_version="ava-recognition-anchor-quote-task-2",
        task_id="pending",
        purpose="repair_inline_anchor_quote",
        prompt_version=ANCHOR_QUOTE_PROMPT_VERSION,
        response_schema_version="ava-recognition-anchor-quote-response-2",
        source_sha256=task.source_sha256,
        profile_id=task.profile_id,
        page_number=task.page_number,
        original_task_id=task.task_id,
        render_sha256=task.image.sha256,
        native_evidence_sha256=task.native_evidence_sha256,
        image=task.image,
        original_response_json=original_response_json,
        original_response_sha256=digest(original_response_json.encode()),
        slots=slots,
    )
    fields["task_id"] = quote_task_id(RecognitionAnchorQuoteTask.model_construct(**fields))
    return RecognitionAnchorQuoteTask.model_validate(fields)


def apply_anchor_quote(
    original_task: RecognitionTask,
    task: RecognitionAnchorQuoteTask,
    response: RecognitionAnchorQuoteResponse,
) -> dict[str, Any]:
    original_task = RecognitionTask.model_validate(original_task.model_dump())
    task = RecognitionAnchorQuoteTask.model_validate(task.model_dump())
    response = RecognitionAnchorQuoteResponse.model_validate(response.model_dump())
    if prepare_anchor_quote(original_task, task.original_response_json) != task or (
        response.task_id,
        response.source_sha256,
        response.original_task_id,
        response.render_sha256,
        response.original_response_sha256,
    ) != (
        task.task_id,
        task.source_sha256,
        task.original_task_id,
        task.render_sha256,
        task.original_response_sha256,
    ):
        raise ValueError("ANCHOR_QUOTE_CORRECTION_BINDING_DIFFERS")
    if response.outcome != "corrected":
        raise ValueError("ANCHOR_QUOTE_UNRESOLVED")
    slots = {(s.segment_index, s.span_index): s for s in task.slots}
    keys = [(p.segment_index, p.span_index) for p in response.patches]
    if len(set(keys)) != len(keys) or set(keys) != set(slots):
        raise ValueError("ANCHOR_QUOTE_PATCH_COVERAGE_DIFFERS")
    patched: dict[str, Any] = copy.deepcopy(strict_json(task.original_response_json.encode()))
    for patch in response.patches:
        slot = slots[(patch.segment_index, patch.span_index)]
        if patch.span_sha256 != slot.span_sha256 or patch.exact_text not in slot.allowed_quotations:
            raise ValueError("ANCHOR_QUOTE_PATCH_DIFFERS")
        anchor = patched["segments"][patch.segment_index]["spans"][patch.span_index]["anchor"]
        anchor.update(exact_text=patch.exact_text, before=patch.before, after=patch.after)
    validate_tasks(
        json_bytes(
            dict(
                mode="validate_tasks",
                tasks=[original_task.model_dump(mode="json")],
                responses=[patched],
            )
        )
    )
    return patched


def validate_anchor_quote(data: bytes) -> dict[str, object]:
    if not 0 < len(data) <= 16 * 1024 * 1024:
        raise ValueError("ANCHOR_QUOTE_VALIDATION_BOUND")
    value = strict_json(data)
    if (
        not isinstance(value, dict)
        or set(value) != {"mode", "task", "correction"}
        or value["mode"] != "validate_anchor_quote"
    ):
        raise ValueError("ANCHOR_QUOTE_VALIDATION_FIELDS")
    original = RecognitionTask.model_validate(value["task"])
    correction = RecognitionAnchorQuoteTask.model_validate(value["correction"])
    if prepare_anchor_quote(original, correction.original_response_json) != correction:
        raise ValueError("ANCHOR_QUOTE_VALIDATION_DIFFERS")
    return dict(
        schema_version="ava-anchor-quote-checked-2",
        request_sha256=digest(data),
        task_id=correction.task_id,
    )
