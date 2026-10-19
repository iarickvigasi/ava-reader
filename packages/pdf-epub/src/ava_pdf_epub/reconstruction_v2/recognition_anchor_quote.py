"""One bounded quotation repair preserves the immutable parent and every non-anchor field."""

import copy
from typing import Any

from .anchor_quote_binding import quote_identifier
from .anchor_quote_slots import quote_slots
from .attempt_exchange import json_bytes, strict_json
from .recognition_anchor_candidates import allowed_quotations
from .recognition_anchor_context import digest
from .recognition_anchor_eligibility import eligible_anchor_response
from .recognition_anchor_quote_contract import (
    ANCHOR_QUOTE_PROMPT_VERSION,
    RecognitionAnchorQuoteResponse,
    RecognitionAnchorQuoteTask,
)
from .recognition_anchors import RecognitionTextAnchor, anchored_offsets
from .recognition_contract import RecognitionTask
from .small_caps_quote_candidates import small_caps_quotations, whole_token_range
from .small_caps_quote_contract import QuoteRepairTask, RecognitionSmallCapsQuoteTask
from .validate_tasks import validate_tasks


def prepare_anchor_quote(
    task: RecognitionTask, original_response_json: str, *, small_caps: bool = False
) -> QuoteRepairTask:
    task = RecognitionTask.model_validate(task.model_dump())
    response, failed = eligible_anchor_response(task, original_response_json)
    candidates_for = small_caps_quotations if small_caps else allowed_quotations
    model = RecognitionSmallCapsQuoteTask if small_caps else RecognitionAnchorQuoteTask
    slots = quote_slots(response, failed, candidates_for)
    fields: dict[str, Any] = dict(
        schema_version="ava-recognition-anchor-quote-task-3"
        if small_caps
        else "ava-recognition-anchor-quote-task-2",
        task_id="pending",
        purpose="repair_inline_anchor_quote",
        prompt_version="ava-recognition-anchor-quote-3"
        if small_caps
        else ANCHOR_QUOTE_PROMPT_VERSION,
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
    fields["task_id"] = quote_identifier(model.model_construct(**fields).model_dump(mode="json"))
    return model.model_validate(fields)


def apply_anchor_quote(
    original_task: RecognitionTask,
    task: QuoteRepairTask,
    response: RecognitionAnchorQuoteResponse,
) -> dict[str, Any]:
    original_task = RecognitionTask.model_validate(original_task.model_dump())
    small_caps = isinstance(task, RecognitionSmallCapsQuoteTask)
    task = type(task).model_validate(task.model_dump())
    response = RecognitionAnchorQuoteResponse.model_validate(response.model_dump())
    if prepare_anchor_quote(
        original_task, task.original_response_json, small_caps=small_caps
    ) != task or (
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
        segment = patched["segments"][patch.segment_index]
        original_span = strict_json(slot.original_span_json.encode())
        if small_caps and not allowed_quotations(segment["text"], original_span):
            start, end = anchored_offsets(
                segment["text"], RecognitionTextAnchor.model_validate(anchor)
            )
            if not whole_token_range(segment["text"], start, end):
                raise ValueError("SMALL_CAPS_QUOTE_SELECTED_RANGE_NOT_WHOLE_TOKEN")
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
    small_caps = value["correction"].get("schema_version") == "ava-recognition-anchor-quote-task-3"
    model = RecognitionSmallCapsQuoteTask if small_caps else RecognitionAnchorQuoteTask
    correction = model.model_validate(value["correction"])
    if (
        prepare_anchor_quote(original, correction.original_response_json, small_caps=small_caps)
        != correction
    ):
        raise ValueError("ANCHOR_QUOTE_VALIDATION_DIFFERS")
    return dict(
        schema_version="ava-anchor-quote-checked-2",
        request_sha256=digest(data),
        task_id=correction.task_id,
    )
