"""Separate printed structural labels from body text without discarding their identities."""

import re

from ..contracts.common import text_digest
from ..contracts.layout_prefix_cut_v3 import PrefixCutReceipt
from .assembly_state import AssemblyState
from .list_markers import MARKER, marker_style
from .marker_typography import marker_typography
from .segments import Segment
from .word_list_markers import retain_word_marker


def printed_markers(segments: list[Segment], state: AssemblyState) -> list[Segment]:
    output = []
    callouts = {m[1] for s in segments for m in re.finditer(r"\[([^]\s]{1,20})\]", s.text)}
    notes_heading = False
    for segment in segments:
        if retain_word_marker(segment, state):
            output.append(segment)
            continue
        if segment.chapter_start:
            notes_heading = bool(re.search(r"\bnotes?\b", segment.text, re.I))
        if segment.kind == "heading" and re.fullmatch(r"(?:end)?notes?", segment.text, re.I):
            notes_heading = True
        bracket = re.match(r"^\[([^]\s]{1,20})\]\s+", segment.text)
        numbered = re.match(r"^(\d+)\.\s+", segment.text)
        footnote = (
            numbered
            and numbered[1] in callouts
            and (
                segment.style and segment.style.relative_size and segment.style.relative_size < 0.95
            )
        )
        if not notes_heading and not footnote and segment.kind != "note":
            numbered = None
        note = bracket or numbered
        if segment.kind in {"paragraph", "list_item"} and note:
            segment = segment.model_copy(
                update={
                    "kind": "note",
                    "note_label": note[1],
                    "note_role": "endnote" if notes_heading else "footnote",
                }
            )
        if segment.kind == "note" and note:
            if segment.note_label not in {note[1], note[0].rstrip()}:
                raise ValueError("Observed printed note label conflicts with its marker")
            # Brackets/full stops decorate the observed key; unrelated labels stay invalid.
            segment = segment.model_copy(update={"note_label": note[1]})
        marker = (
            note
            if segment.kind == "note"
            else MARKER.match(segment.text)
            if segment.kind == "list_item"
            else None
        )
        if marker:
            if segment.kind == "list_item":
                label = marker["marker"]
                state.marker_styles[segment.id] = marker_style(label, segment.list_start)
                style_id = state.style_id(marker_typography(segment, len(label)))
                if style_id is not None:
                    state.marker_presentations[segment.id] = style_id
            cut = marker.end()
            if state.word_wrap_active and segment.method == "native":
                source = segment.source_text
                if (
                    not source
                    or not segment.native_line_ids
                    or not source.startswith(segment.text[:cut])
                ):
                    raise ValueError("Printed marker lacks an exact native source prefix")
                line_id = segment.native_line_ids[0]
                first_line = source.split("\n", 1)[0]
                prefix = source[:cut]
                printed_marker = prefix.strip()
                label = (
                    segment.note_label
                    if segment.kind == "note"
                    else marker["marker"].strip("[]().")
                )
                if label is None or line_id in state.source_prefix_cuts:
                    raise ValueError("Repeated or unlabelled native marker cut")
                state.source_prefix_cuts[line_id] = PrefixCutReceipt(
                    line_id=line_id,
                    raw_prefix=prefix,
                    raw_prefix_sha256=text_digest(prefix),
                    original_line_sha256=text_digest(first_line),
                    role="note" if segment.kind == "note" else "list_item",
                    label=label,
                    marker_text=printed_marker,
                )
            if state.word_wrap_active:
                from .layout_hyphen_offsets import layout_hyphen_range
                from .marker_cut_positions import marker_cut_positions

                marker_cut_positions(segment.id, cut, len(segment.text), state)
                for span in segment.spans:
                    if span.url or span.note_label or span.target_text:
                        layout_hyphen_range(
                            span.start,
                            span.end,
                            [(0, cut)],
                            len(segment.text),
                            referenced=True,
                        )
            else:
                state.internal_targets = [
                    (owner, start - cut, end - cut, target, offset)
                    if owner == segment.id
                    else (owner, start, end, target, offset)
                    for owner, start, end, target, offset in state.internal_targets
                ]
            spans = [
                s.model_copy(update={"start": max(s.start, cut) - cut, "end": s.end - cut})
                for s in segment.spans
                if s.end > cut
            ]
            source = segment.source_text
            segment = segment.model_copy(
                update={
                    "text": segment.text[cut:],
                    "spans": spans,
                    "source_text": source[cut:]
                    if source and source.startswith(segment.text[:cut])
                    else None,
                }
            )
        output.append(segment)
    return output
