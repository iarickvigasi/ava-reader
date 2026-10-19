"""Compact proven native layout breaks after refinement; source/task identities stay intact."""

import re

from ..contracts.layout_wrap import compound_wrap
from ..contracts.normalization import NormalizationMap
from .assembly_state import AssemblyState
from .normalization_map import line_wrap_map
from .segments import Segment


def _compacted(segment: Segment) -> tuple[Segment, list[tuple[int, int]]]:
    source = segment.source_text
    if segment.method != "native" or segment.kind not in {"paragraph", "note", "list_item"}:
        return segment, []
    if not source or source == segment.text:
        return segment, []
    matches = [
        m
        for m in re.finditer(r"[ \t]*(?:\r\n|\r|\n)[ \t]*", source)
        if compound_wrap(source, *m.span())
    ]
    if not matches:
        return segment, []
    mapping = NormalizationMap.model_validate(line_wrap_map(source, segment.text))
    mapping.validate_canonical(segment.text)
    ranges = [
        (mapping.source_boundary(m.start()), mapping.source_boundary(m.end())) for m in matches
    ]
    # Already compacted breaks have equal canonical boundaries. Validate the
    # mapping above, then leave these untouched on repeated assembly passes.
    ranges = [(a, b) for a, b in ranges if a != b]
    if not ranges:
        return segment, []
    if any(not segment.text[a:b].isspace() for a, b in ranges):
        raise ValueError("Compound wrap does not identify only layout whitespace")

    def offset(value: int) -> int:
        return _offset(value, ranges)

    parts, at = [], 0
    for start, end in ranges:
        parts.append(segment.text[at:start])
        at = end
    parts.append(segment.text[at:])
    text = "".join(parts)
    spans = []
    for span in segment.spans:
        start, end = offset(span.start), offset(span.end)
        if start == end:
            if span.url or span.note_label or span.target_text:
                raise ValueError("Cannot remove a referenced layout-only range")
            continue
        spans.append(span.model_copy(update={"start": start, "end": end}))
    updated = segment.model_copy(update={"text": text, "spans": spans})
    NormalizationMap.model_validate(line_wrap_map(source, text)).validate_canonical(text)
    return Segment.model_validate(updated.model_dump()), ranges


def _offset(value: int, ranges: list[tuple[int, int]]) -> int:
    return value - sum(max(0, min(value, end) - start) for start, end in ranges)


def compact_compound_wraps(segment: Segment) -> Segment:
    return _compacted(segment)[0]


def compact_native_compounds(segments: list[Segment], state: AssemblyState) -> list[Segment]:
    updates = [_compacted(segment) for segment in segments]
    ranges = {segment.id: removed for segment, removed in updates if removed}

    def shifted(ident: str, value: int) -> int:
        return _offset(value, ranges.get(ident, []))

    targets = []
    for origin, start, end, target, at in state.internal_targets:
        new_start, new_end = shifted(origin, start), shifted(origin, end)
        if new_start == new_end:
            raise ValueError("Cannot remove an internally referenced layout-only range")
        targets.append((origin, new_start, new_end, target, shifted(target, at)))
    state.internal_targets = targets
    state.aliases = {
        alias: (target, shifted(target, at)) for alias, (target, at) in state.aliases.items()
    }
    return [segment for segment, _ in updates]
