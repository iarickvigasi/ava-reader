"""Native text is untrusted when display operations can conceal or replace its glyphs."""

from typing import Any

from pypdf import PdfReader
from pypdf.generic import ContentStream


def display_risks(page: Any, reader: PdfReader) -> list[str]:
    contents = page.get_contents()
    if contents is None:
        return []
    risks: set[str] = set()
    _inspect(contents, page.get("/Resources", {}), reader, risks, set(), 0)
    return sorted(risks)


def _inspect(
    stream: Any, resources: Any, reader: PdfReader, risks: set[str], seen: set[int], depth: int
) -> None:
    stream = stream.get_object() if hasattr(stream, "get_object") else stream
    resources = resources.get_object() if hasattr(resources, "get_object") else resources
    if depth > 12 or id(stream) in seen:
        risks.add("complex_graphics_state")
        return
    seen = seen | {id(stream)}
    content = ContentStream(stream, reader)
    if len(content.operations) > 1000000:
        raise ValueError("PDF content operation limit exceeded")
    for values, operator in content.operations:
        if operator == b"Tr" and values and int(values[0]) != 0:
            risks.add("nonstandard_text_rendering")
        if operator in {b"W", b"W*", b"gs"}:
            risks.add("conditional_visibility")
        if operator == b"BDC" and values and str(values[0]) == "/OC":
            risks.add("optional_content")
        if operator == b"Do" and values:
            obj = resources.get("/XObject", {}).get(values[0])
            if obj is not None:
                obj = obj.get_object()
                if obj.get("/Subtype") == "/Form":
                    _inspect(obj, obj.get("/Resources", resources), reader, risks, seen, depth + 1)
