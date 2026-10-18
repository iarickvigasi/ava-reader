"""Authored mechanical anchor-case witnesses, not a source-fidelity oracle."""

from ava_pdf_epub.reconstruction_v2.recognition_anchor_quote_contract import (
    RecognitionAnchorQuoteResponse,
)

from .test_recognition_anchor_context import fixture as base


def fixture(text="A😀 BC and ABCD."):
    parent, raw = base()
    raw["segments"] = raw["segments"][:1]
    owner = raw["segments"][0]
    owner["text"] = text
    owner["spans"] = [owner["spans"][0]]
    owner["spans"][0]["style"] = {"id": "observed", "small_caps": True}
    owner["spans"][0]["anchor"] = {"exact_text": "bc"}
    return parent, raw


def correction(task, before="😀 ", after=" and"):
    slot = task.slots[0]
    return RecognitionAnchorQuoteResponse.model_validate(
        dict(
            schema_version="ava-recognition-anchor-quote-response-2",
            task_id=task.task_id,
            source_sha256=task.source_sha256,
            original_task_id=task.original_task_id,
            render_sha256=task.render_sha256,
            original_response_sha256=task.original_response_sha256,
            outcome="corrected",
            unresolved_reason=None,
            patches=[
                dict(
                    segment_index=slot.segment_index,
                    span_index=slot.span_index,
                    span_sha256=slot.span_sha256,
                    exact_text="BC",
                    before=before,
                    after=after,
                )
            ],
        )
    )
