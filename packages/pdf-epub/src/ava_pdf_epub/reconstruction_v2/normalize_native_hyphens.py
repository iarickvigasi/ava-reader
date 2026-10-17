"""Apply named native decisions once, after raw annotations/links and final roles."""

from ..contracts.layout_normalization import LayoutNormalizationMap
from ..contracts.normalization import NormalizationMap
from .assembly_state import AssemblyState
from .layout_hyphen_derivation import derive_layout_hyphen
from .layout_hyphen_normalization import normalize_layout_hyphens
from .layout_hyphen_offsets import layout_hyphen_offset, layout_hyphen_range
from .native_hyphen_decisions import NativeHyphenDecision
from .normalization_map import line_wrap_map
from .segments import Segment


def normalize_native_hyphens(segments: list[Segment], state: AssemblyState) -> list[Segment]:
    owners = {ident: s for s in segments for ident in s.native_line_ids}
    grouped: dict[str, list[NativeHyphenDecision]] = {}
    for decision in state.native_hyphen_decisions:
        candidate = decision.candidate
        left, right = owners.get(candidate.left.line_id), owners.get(candidate.right.line_id)
        if left is None or right is None:
            raise ValueError("Layout-hyphen decision lost its source owner")
        if left is not right or left.kind != candidate.role or left.preserve_line_breaks:
            if decision.disposition.disposition == "layout":
                raise ValueError("Layout-hyphen decision lost its confirmed prose grouping")
            continue  # Literal evidence does not authorize joining independent source blocks.
        grouped.setdefault(left.id, []).append(decision)
    result, changes = [], {}
    for segment in segments:
        decisions = grouped.get(segment.id, [])
        if not decisions:
            result.append(segment)
            continue
        if segment.method != "native" or segment.source_text is None:
            raise ValueError("Layout-hyphen owner lost its literal native source")
        raw = "\n".join(state.native_source_lines[ident] for ident in segment.native_line_ids)
        if raw != segment.source_text:
            raise ValueError(
                "Layout-hyphen source no longer reproduces its ordered line identities"
            )
        positions, cursor = {}, 0
        for ident in segment.native_line_ids:
            positions[ident] = cursor
            cursor += len(state.native_source_lines[ident]) + 1
        derived = [
            derive_layout_hyphen(
                raw, d.pair_source, d.candidate, d.disposition, positions[d.candidate.left.line_id]
            )
            for d in decisions
        ]
        base = NormalizationMap.model_validate(line_wrap_map(raw, segment.text))
        normalized = normalize_layout_hyphens(
            raw,
            decisions[0].candidate.source_sha256,
            [d.candidate for d in derived],
            [d.disposition for d in derived],
            text=segment.text,
            normalization=base,
            derivations=[d.derivation for d in derived],
        )
        assert isinstance(normalized.normalization, LayoutNormalizationMap)
        spans = []
        for span in segment.spans:
            start, end = layout_hyphen_range(
                span.start,
                span.end,
                normalized.removals,
                len(segment.text),
                referenced=bool(span.url or span.note_label or span.target_text),
            )
            if start != end:
                spans.append(span.model_copy(update={"start": start, "end": end}))
        updated = Segment.model_validate(
            {**segment.model_dump(), "text": normalized.text, "spans": spans}
        )
        state.normalization_maps[segment.id] = normalized.normalization
        changes[segment.id] = (normalized.removals, len(segment.text))
        result.append(updated)
    _remap_positions(state, changes)
    state.native_hyphen_decisions.clear()
    return result


def _remap_positions(
    state: AssemblyState, changes: dict[str, tuple[list[tuple[int, int]], int]]
) -> None:
    def shifted(ident: str, offset: int) -> int:
        if ident not in changes:
            return offset
        ranges, length = changes[ident]
        return layout_hyphen_offset(offset, ranges, length)

    targets = []
    for owner, start, end, target, at in state.internal_targets:
        if owner in changes:
            ranges, length = changes[owner]
            start, end = layout_hyphen_range(start, end, ranges, length, referenced=True)
        targets.append((owner, start, end, target, shifted(target, at)))
    state.internal_targets = targets
    state.aliases = {
        alias: (target, shifted(target, at)) for alias, (target, at) in state.aliases.items()
    }
    # These receipts retain raw text hashes, not rewritten proof. Native source
    # features currently have no OCR appearance receipt; refuse any future overlap.
    if any(e["node_id"] in changes for e in state.source_feature_evidence):
        raise ValueError(
            "Layout-hyphen normalization overlaps an unremapped source-feature receipt"
        )
    if any(
        ident in changes and role is not None
        for ident, (role, _) in state.bibliographic_roles.items()
    ):
        raise ValueError("Layout-hyphen normalization overlaps a bibliographic range receipt")
    if state.printed_title is not None and state.printed_title[0] in changes:
        raise ValueError("Layout-hyphen normalization overlaps a printed-title receipt")
