"""Extract printed labels and title-page hierarchy; file dates are not publication dates."""

import re
from typing import Any

from .assembly_state import AssemblyState
from .metadata_scope import metadata_scope

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
    title, eligible = metadata_scope(state)
    if title is not None:
        output.append(_claim("title", title["content"]["text"], title))
        index = state.blocks.index(title)
        if index + 1 < len(state.blocks):
            following = state.blocks[index + 1]
            text = following.get("content", {}).get("text", "")
            segment = state.segments[following["id"]]
            gap = segment.box.y0 - state.segments[title["id"]].box.y1
            if (
                following["id"] in eligible
                and (
                    following["id"] not in state.bibliographic_roles
                    or state.bibliographic_roles[following["id"]][0] == "subtitle"
                )
                and following["kind"] == "paragraph"
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
        selected = state.bibliographic_roles.get(block["id"])
        if selected and selected[0] is not None and block["id"] in eligible:
            classified_role, selected_text = selected
            assert classified_role is not None
            text = selected_text.strip()
            metadata_field = (
                "contributor"
                if classified_role in {"author", "translator", "editor", "illustrator"}
                else classified_role
            )
            if text:
                claim = _claim(metadata_field, text, block)
                if metadata_field == "contributor":
                    claim["contributor_role"] = classified_role
                output.append(claim)
    for block in state.blocks:
        text = block.get("content", {}).get("text", "")
        if block["kind"] != "paragraph" or not PATTERN.match(text):
            continue
        status = "accepted" if block["id"] in eligible else "candidate"
        matches = list(PATTERN.finditer(text))
        for index, match in enumerate(matches):
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            value = text[match.end() : end].strip(" ;/")
            label = match.group("label") or match.group("by")
            if label is None:
                continue
            field, role = LABELS[label.lower()]
            if value:
                claim = _claim(field, value, block, status)
                if role:
                    claim["contributor_role"] = role
                output.append(claim)
        isbn = re.search(r"ISBN[^0-9]{0,40}([0-9][0-9Xx -]{8,20}[0-9Xx])", text)
        if isbn:
            value = re.sub(r"[^0-9Xx]", "", isbn[1])
            if len(value) in {10, 13}:
                output.append(
                    {**_claim("identifier", value, block, status), "identifier_scheme": "isbn"}
                )
    return output


def _claim(
    field: str, value: str, block: dict[str, Any], status: str = "accepted"
) -> dict[str, Any]:
    return dict(
        field=field,
        value=value[:4000],
        status=status,
        origin="source",
        evidence=block["evidence"],
        scope="source_edition"
        if field in {"publisher", "date", "edition", "identifier"}
        else "work",
    )
