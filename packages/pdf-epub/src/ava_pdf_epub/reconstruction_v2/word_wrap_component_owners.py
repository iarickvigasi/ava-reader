"""Bind prejoin components to their final text owners through exact checked aliases."""

from collections.abc import Mapping, Sequence

from ..contracts.common import unique
from .segments import Segment


def word_wrap_component_owners(
    segments: Sequence[Segment],
    components: Sequence[Segment],
    aliases: Mapping[str, tuple[str, int]],
) -> dict[str, list[Segment]]:
    unique([segment.id for segment in segments], "word-wrap final segment")
    unique([component.id for component in components], "word-wrap prejoin component")
    owners = {segment.id: segment for segment in segments if segment.native_line_ids}
    grouped: dict[str, list[tuple[int, Segment]]] = {}
    for component in components:
        target, at = _resolve_component(component.id, aliases)
        if target not in owners:
            continue
        if not component.text or component.method not in {"native", "ocr"}:
            raise ValueError("Word-wrap final text owner has an unqualified source component")
        grouped.setdefault(target, []).append((at, component))
    output = {}
    for ident, owner in owners.items():
        rows = sorted(grouped.get(ident, []), key=lambda row: row[0])
        if not rows:
            raise ValueError("Word-wrap final native owner has no prejoin source component")
        cursor = 0
        for index, (at, component) in enumerate(rows):
            gap = owner.text[cursor:at]
            if (
                (index == 0 and at != 0)
                or not cursor <= at <= cursor + 1
                or gap not in {"", " ", "\n"}
                or owner.text[at : at + len(component.text)] != component.text
            ):
                raise ValueError("Word-wrap prejoin component text/offset differs from its owner")
            cursor = at + len(component.text)
        if cursor != len(owner.text):
            raise ValueError("Word-wrap source components leave unaccounted owner text")
        parts = [component for _, component in rows]
        if [ident for part in parts for ident in part.native_line_ids] != owner.native_line_ids:
            raise ValueError("Word-wrap final owner native IDs differ from its source components")
        output[ident] = parts
    return output


def _resolve_component(ident: str, aliases: Mapping[str, tuple[str, int]]) -> tuple[str, int]:
    at, visited = 0, set()
    while ident in aliases:
        if ident in visited:
            raise ValueError("Word-wrap source component alias is cyclic")
        visited.add(ident)
        target, offset = aliases[ident]
        if type(offset) is not int or offset < 0:
            raise ValueError("Word-wrap source component alias has no exact text offset")
        ident, at = target, at + offset
    return ident, at
