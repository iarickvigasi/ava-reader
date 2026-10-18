"""Shared binding mechanics; quotation choices remain explicitly versioned by the caller."""

import base64
from collections.abc import Callable
from typing import Any

from .attempt_exchange import json_bytes, strict_json
from .recognition_anchor_context import digest
from .recognition_anchor_eligibility import REASONS, RESPONSE_BYTES
from .recognition_anchors import RecognitionTextAnchor, anchored_offsets


def quote_binding(
    value: dict[str, Any], candidates: Callable[[str, dict[str, Any]], list[str]]
) -> None:
    raw = value["original_response_json"].encode()
    pixels = base64.b64decode(value["image"]["base64"], validate=True)
    if (
        len(raw) > RESPONSE_BYTES
        or digest(raw) != value["original_response_sha256"]
        or len(pixels) != value["image"]["byte_length"]
        or digest(pixels) != value["image"]["sha256"]
        or value["image"]["sha256"] != value["render_sha256"]
    ):
        raise ValueError("ANCHOR_QUOTE_BYTES_DIFFER")
    response = strict_json(raw)
    if not isinstance(response, dict) or (
        response.get("task_id"),
        response.get("source_sha256"),
        response.get("render_sha256"),
    ) != (value["original_task_id"], value["source_sha256"], value["render_sha256"]):
        raise ValueError("ANCHOR_QUOTE_PARENT_DIFFERS")
    seen = set()
    for slot in value["slots"]:
        key = (slot["segment_index"], slot["span_index"])
        if key in seen:
            raise ValueError("ANCHOR_QUOTE_REPEATED_SLOT")
        seen.add(key)
        try:
            segment = response["segments"][slot["segment_index"]]
            span = segment["spans"][slot["span_index"]]
            if (
                segment["id"] != slot["segment_id"]
                or digest(segment["text"].encode()) != slot["segment_text_sha256"]
                or digest(slot["original_span_json"].encode()) != slot["span_sha256"]
                or strict_json(slot["original_span_json"].encode()) != span
                or any(
                    span.get(k) is not None
                    for k in ("url", "note_label", "target_text", "start", "end")
                )
                or candidates(segment["text"], span) != slot["allowed_quotations"]
            ):
                raise ValueError("ANCHOR_QUOTE_SLOT_DIFFERS")
            anchor = RecognitionTextAnchor.model_validate(span["anchor"])
        except (KeyError, IndexError, TypeError, AttributeError):
            raise ValueError("ANCHOR_QUOTE_SLOT_DIFFERS") from None
        try:
            anchored_offsets(segment["text"], anchor)
        except ValueError as error:
            if REASONS.get(str(error)) != slot["reason"]:
                raise ValueError("ANCHOR_QUOTE_REASON_DIFFERS") from None
        else:
            raise ValueError("ANCHOR_QUOTE_ALREADY_VALID")
    if value["task_id"] != quote_identifier(value):
        raise ValueError("ANCHOR_QUOTE_ID_DIFFERS")


def quote_identifier(value: dict[str, Any]) -> str:
    projection = [
        value["schema_version"],
        value["source_sha256"],
        value["profile_id"],
        value["page_number"],
        value["original_task_id"],
        value["render_sha256"],
        value["native_evidence_sha256"],
        value["original_response_sha256"],
        [
            [
                s["segment_index"],
                s["segment_id"],
                s["segment_text_sha256"],
                s["span_index"],
                s["span_sha256"],
                s["reason"],
                s["allowed_quotations"],
            ]
            for s in value["slots"]
        ],
    ]
    return "anchor-quote-" + digest(json_bytes(projection))
