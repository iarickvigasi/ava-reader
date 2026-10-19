"""Extract printed labels and title-page hierarchy; file dates are not publication dates."""

import re
from typing import Any

from .assembly_state import AssemblyState
from .metadata_scope import metadata_scope
from .opening_author_credits import opening_author_credits
from .printed_bibliographic_claims import printed_bibliographic_claims
from .printed_claim import printed_claim as _claim
from .printed_identifiers import identifier_claims
from .printed_title_claim import printed_title_claim

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
    title, eligible = metadata_scope(state)
    if (
        state.printed_title is not None
        and title is not None
        and title["id"] == state.printed_title[0]
    ):
        title = None  # This candidate has its own explicit title-or-null authority.
    output = opening_author_credits(state, title, source_author)
    classified_title = printed_title_claim(state)
    if classified_title is not None:
        output.append(classified_title)
    if title is not None and state.source_title_policy is None:
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
    output.extend(printed_bibliographic_claims(state, eligible))
    for block in state.blocks:
        text = block.get("content", {}).get("text", "")
        if block["kind"] != "paragraph":
            continue
        labelled = PATTERN.match(text)
        status = "accepted" if block["id"] in eligible else "candidate"
        output.extend(
            identifier_claims(block, status if labelled else "candidate", block["id"] in eligible)
        )
        if not labelled:
            continue
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
    return output
