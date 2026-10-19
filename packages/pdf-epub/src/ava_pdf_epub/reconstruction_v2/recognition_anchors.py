"""Exact quotations anchor inline observations without model-generated character counts."""

from pydantic import Field

from ..contracts.common import Record


class RecognitionTextAnchor(Record):
    exact_text: str = Field(
        min_length=1,
        max_length=1000,
        description="Copy verbatim from the finalized owning segment/cell text. Unicode scalars, "
        "case and spaces must be identical; an ordinary digit cannot anchor a Unicode script "
        "digit. "
        "Together with before/after, this quotation must identify exactly one occurrence.",
    )
    before: str = Field(
        default="",
        max_length=128,
        exclude_if=lambda value: value == "",
        description="Exact immediately adjacent preceding context in the same finalized text, "
        "including Unicode and spaces. Empty means no preceding-context constraint.",
    )
    after: str = Field(
        default="",
        max_length=128,
        exclude_if=lambda value: value == "",
        description="Exact immediately adjacent following context in the same finalized text, "
        "including Unicode and spaces. Empty means no following-context constraint.",
    )


def anchored_offsets(text: str, anchor: RecognitionTextAnchor) -> tuple[int, int]:
    matches: list[tuple[int, int]] = []
    at = text.find(anchor.exact_text)
    while at >= 0:
        end = at + len(anchor.exact_text)
        if text[:at].endswith(anchor.before) and text[end:].startswith(anchor.after):
            matches.append((at, end))
            if len(matches) > 1:
                raise ValueError("Ambiguous exact inline anchor")
        at = text.find(anchor.exact_text, at + 1)
    if len(matches) != 1:
        raise ValueError("Inline anchor is absent from exact text")
    return matches[0]
