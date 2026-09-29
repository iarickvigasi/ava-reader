"""Store exact codepoint text and explicit line-wrap provenance, never implicit normalization."""

import re
from typing import Any

from ..contracts.common import text_digest
from ..contracts.offsets import codepoint_to_utf16
from .assembly_state import AssemblyState
from .normalization_map import line_wrap_map
from .segments import ObservedSpan


def canonical_text(
    text: str, spans: list[ObservedSpan], source: str | None, ident: str, state: AssemblyState
) -> dict[str, Any]:
    converted = []
    for index, span in enumerate(spans):
        style_id = state.style_id(span.style)
        link = {"kind": "external", "url": span.url} if span.url else None
        if style_id is not None or link:
            converted.append(
                dict(
                    id=f"{ident}-span{index}",
                    start=span.start,
                    end=span.end,
                    style_id=style_id,
                    link=link,
                )
            )
    normalization = None
    if source and source != text:
        wrapped = re.sub(r"[ \t]*(?:\r\n|\r|\n)[ \t]*", " ", source)
        if wrapped != text:
            raise ValueError("Unaccounted source-to-canonical text transformation")
        normalization = line_wrap_map(source, text)
    return dict(
        text=text,
        sha256=text_digest(text),
        spans=converted,
        normalization=normalization,
        codepoint_utf16=codepoint_to_utf16(text),
    )
