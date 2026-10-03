"""Bind exact inline quotations into canonical code-point offsets without rewriting text."""

from typing import Any

from .recognition_fields import RecognitionSpan


def source_spans(spans: list[RecognitionSpan], text: str) -> list[dict[str, Any]]:
    result = []
    for span in spans:
        start, end = span.offsets(text)
        result.append(
            {**span.model_dump(exclude={"anchor", "start", "end"}), "start": start, "end": end}
        )
    return result
