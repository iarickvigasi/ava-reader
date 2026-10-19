"""The host owns positions for an exact, standalone printed web address."""

from typing import Any

from ..pdf_navigation import navigation_uri


def anchor_literal_url(value: Any) -> Any:
    if not isinstance(value, dict) or not isinstance(value.get("text"), str):
        return value
    text = value["text"]
    label = text.strip()
    if not label.startswith(("www.", "https://", "http://")):
        return value
    try:
        target = navigation_uri(label).url
    except ValueError:
        return value
    if not target:
        return value
    spans = value.get("spans")
    if not isinstance(spans, list) or len(spans) != 1:
        return value
    span = spans[0]
    if not isinstance(span, dict) or any(
        span.get(key) is not None for key in ("note_label", "target_text")
    ):
        return value
    start, end = span.get("start"), span.get("end")
    if type(start) is not int or type(end) is not int:
        return value
    if not 0 <= start <= 200000 or not 1 <= end <= 200000:
        return value
    url = span.get("url")
    labels = {label, target}
    if label.startswith("www."):
        labels.add("http://" + label)
    if not isinstance(url, str) or url not in labels:
        return value
    at = len(text) - len(text.lstrip())
    # Preserve independent typography: only an already exact full-label range
    # may have its scheme resolved from the printed literal address.
    if span.get("style") is not None and (start, end) != (at, at + len(label)):
        return value
    # A plain URL-only span has no separately positioned typography or note role.
    # Its positions come from exact entire-label evidence, never approximate text.
    return {**value, "spans": [{**span, "start": at, "end": at + len(label), "url": target}]}
