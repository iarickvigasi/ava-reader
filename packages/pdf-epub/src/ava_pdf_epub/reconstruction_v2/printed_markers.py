"""Separate printed structural labels from body text without discarding their identities."""

import re

from .assembly_state import AssemblyState
from .list_markers import MARKER, marker_style
from .segments import Segment


def printed_markers(segments: list[Segment], state: AssemblyState) -> list[Segment]:
    output = []
    callouts = {m[1] for s in segments for m in re.finditer(r"\[([^]\s]{1,20})\]", s.text)}
    notes_heading = False
    for segment in segments:
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
            cut = marker.end()
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
