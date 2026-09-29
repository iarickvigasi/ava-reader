"""Extract printed labels and title-page hierarchy; file dates are not publication dates."""

import re
from typing import Any

from .assembly_state import AssemblyState

LABELS = {
    "author": ("contributor", "author"),
    "translated by": ("contributor", "translator"),
    "edited by": ("contributor", "editor"),
    "illustrated by": ("contributor", "illustrator"),
    "publisher": ("publisher", None),
    "edition": ("edition", None),
    "publication date": ("date", None),
    "language": ("language", None),
    "rights": ("rights", None),
}
PATTERN = re.compile(
    r"(?:^|[;/ ]+)(?P<label>author|publisher|edition|publication date|language|rights)\s*:\s*"
    r"|(?:^|[;/ ]+)(?P<by>translated by|edited by|illustrated by)\s+"
    r"|(?:^|[;/ ]+)(?P<isbn>(?:printed\s+)?ISBN[^:\n]{0,30})\s*:\s*",
    re.I,
)


def printed_metadata(state: AssemblyState, source_author: str | None) -> list[dict[str, Any]]:
    output = []
    candidates = [
        b
        for b in state.blocks
        if b["kind"] == "heading"
        and b["evidence"][0]["page"] == 1
        and not state.segments[b["id"]].chapter_start
    ]
    if candidates:
        title = candidates[0]
        output.append(_claim("title", title["content"]["text"], title))
        index = state.blocks.index(title)
        if index + 1 < len(state.blocks):
            following = state.blocks[index + 1]
            text = following.get("content", {}).get("text", "")
            segment = state.segments[following["id"]]
            gap = segment.box.y0 - state.segments[title["id"]].box.y1
            if (
                following["kind"] == "paragraph"
                and 0 < gap < 35
                and segment.style
                and segment.style.align == "center"
                and not (
                    source_author
                    and source_author in text
                    or PATTERN.search(text)
                    or re.search(r"\d{4}-\d{2}-\d{2}", text)
                )
            ):
                output.append(_claim("subtitle", text, following))
    for block in state.blocks:
        text = block.get("content", {}).get("text", "")
        matches = list(PATTERN.finditer(text))
        for index, match in enumerate(matches):
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            value = text[match.end() : end].strip(" ;/")
            label = match.group("label") or match.group("by")
            if label is None:
                continue
            field, role = LABELS[label.lower()]
            if value:
                claim = _claim(field, value, block)
                if role:
                    claim["contributor_role"] = role
                output.append(claim)
        isbn = re.search(r"ISBN[^0-9]{0,40}([0-9][0-9Xx -]{8,20}[0-9Xx])", text)
        if isbn:
            value = re.sub(r"[^0-9Xx]", "", isbn[1])
            if len(value) in {10, 13}:
                output.append({**_claim("identifier", value, block), "identifier_scheme": "isbn"})
    return output


def _claim(field: str, value: str, block: dict[str, Any]) -> dict[str, Any]:
    return dict(
        field=field,
        value=value[:4000],
        status="accepted",
        origin="source",
        evidence=block["evidence"],
        scope="source_edition"
        if field in {"publisher", "date", "edition", "identifier"}
        else "work",
    )
