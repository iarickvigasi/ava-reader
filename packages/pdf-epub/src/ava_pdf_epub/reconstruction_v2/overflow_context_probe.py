"""A closed shape probe masks only separately validated pure-typography context slots."""

import copy
import hashlib
from typing import Any

from .attempt_exchange import json_bytes
from .overflow_context_slot import OverflowContextAnchor, OverflowContextSlot
from .recognition_contract import RecognitionResponse
from .recognition_fields import RecognitionSpan


def overflow_context_probe(
    response: dict[str, Any],
) -> tuple[dict[str, Any], list[OverflowContextSlot]]:
    probe, slots, overflow = copy.deepcopy(response), [], False
    segments = response.get("segments")
    if not isinstance(segments, list) or not 0 < len(segments) <= 2000:
        raise ValueError("OVERFLOW_CONTEXT_SEGMENT_BOUND")
    for index, segment in enumerate(segments):
        if (
            not isinstance(segment, dict)
            or not isinstance(segment.get("text"), str)
            or not isinstance(segment.get("spans"), list)
            or len(segment["spans"]) > 20000
        ):
            raise ValueError("OVERFLOW_CONTEXT_SPAN_SHAPE")
        retained = []
        for span_index, span in enumerate(segment.get("spans", [])):
            if not isinstance(span, dict):
                raise ValueError("OVERFLOW_CONTEXT_SPAN_SHAPE")
            anchor = OverflowContextAnchor.model_validate(span.get("anchor"))
            bounded = {
                **span,
                "anchor": {"exact_text": anchor.exact_text, "before": "", "after": ""},
            }
            # Check the masked span's own closed fields/style before any shape-only omission.
            RecognitionSpan.model_validate(bounded)
            too_long = max(len(anchor.before), len(anchor.after)) > 128
            text, count, at = segment["text"], 0, segment["text"].find(anchor.exact_text)
            while at >= 0:
                end = at + len(anchor.exact_text)
                if text[:at].endswith(anchor.before) and text[end:].startswith(anchor.after):
                    count += 1
                at = text.find(anchor.exact_text, at + 1)
            if not too_long and count == 1:
                retained.append(span)
                continue
            if (
                not span.get("style")
                or anchor.exact_text not in text
                or any(
                    span.get(k) is not None
                    for k in ("url", "note_label", "target_text", "start", "end")
                )
            ):
                raise ValueError("OVERFLOW_CONTEXT_SLOT_NOT_PURE_TYPOGRAPHY")
            overflow |= too_long
            original = json_bytes(span).decode()
            slots.append(
                OverflowContextSlot(
                    segment_index=index,
                    segment_id=segment["id"],
                    span_index=span_index,
                    segment_text_sha256=hashlib.sha256(text.encode()).hexdigest(),
                    original_span_json=original,
                    span_sha256=hashlib.sha256(original.encode()).hexdigest(),
                    reason="CONTEXT_LIMIT"
                    if too_long
                    else "AMBIGUOUS_CONTEXT"
                    if count > 1
                    else "ABSENT_CONTEXT",
                )
            )
        probe["segments"][index]["spans"] = retained
    if not overflow or not 0 < len(slots) <= 512:
        raise ValueError("OVERFLOW_CONTEXT_CANDIDATE_REQUIRED")
    RecognitionResponse.model_validate(probe)
    return probe, slots
