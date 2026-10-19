"""Collect only failed pure typography slots, retaining the exact original span bytes."""

from collections.abc import Callable
from typing import Any

from .attempt_exchange import json_bytes
from .recognition_anchor_context import digest
from .recognition_anchor_eligibility import REASONS
from .recognition_anchor_quote_contract import AnchorQuoteSlot
from .recognition_anchors import RecognitionTextAnchor, anchored_offsets


def quote_slots(
    response: dict[str, Any],
    failed: set[int],
    candidates_for: Callable[[str, dict[str, Any]], list[str]],
) -> list[AnchorQuoteSlot]:
    slots: list[AnchorQuoteSlot] = []
    for index in sorted(failed):
        segment = response["segments"][index]
        for span_index, span in enumerate(segment["spans"]):
            anchor = RecognitionTextAnchor.model_validate(span.get("anchor"))
            try:
                anchored_offsets(segment["text"], anchor)
            except ValueError as error:
                reason = REASONS.get(str(error))
                candidates = candidates_for(segment["text"], span)
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
    return slots
