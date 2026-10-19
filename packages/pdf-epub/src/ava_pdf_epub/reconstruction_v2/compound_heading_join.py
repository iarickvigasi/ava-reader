"""Materialize one corroborated heading with exact component and position provenance."""

import hashlib

from ..contracts.source import Box
from .assembly_state import AssemblyState
from .compound_heading_styles import LAYOUT_FIELDS, heading_spans
from .findings import Finding
from .segments import Segment


def join_heading(pieces: list[Segment], state: AssemblyState) -> Segment:
    first = pieces[0]
    if len(pieces) < 2 or any(p.page != first.page or p.method != first.method for p in pieces):
        raise ValueError("Compound heading requires same-page source components")
    if any(p.id in state.aliases or p.id in state.normalization_maps for p in pieces):
        raise ValueError("Compound heading must precede source joins and normalization")
    if any(p.chapter_start for p in pieces[1:]):
        raise ValueError("Compound heading crosses a detected chapter opening")
    if any(p.continues_from_previous or p.continues_to_next for p in pieces):
        raise ValueError("Compound heading cannot consume a prose continuation")
    evidence, spans, text, offsets = [], [], "", {}
    for piece in pieces:
        observed = state.evidence.get(piece.id, [])
        if len(observed) != 1 or observed[0]["page"] != piece.page:
            raise ValueError("Compound heading requires original page-owned observations")
        if text:
            text += "\n"
        offset = len(text)
        offsets[piece.id] = offset
        text += piece.text
        spans.extend(heading_spans(piece, first.style, offset))
        evidence.extend(observed)
    box = Box.model_validate(
        {
            **first.box.model_dump(),
            "x0": min(p.box.x0 for p in pieces),
            "y0": min(p.box.y0 for p in pieces),
            "x1": max(p.box.x1 for p in pieces),
            "y1": max(p.box.y1 for p in pieces),
        }
    )
    joined = Segment.model_validate(
        {
            **first.model_dump(),
            "text": text,
            "source_text": "\n".join(p.source_text or p.text for p in pieces),
            "box": box,
            "spans": [s.model_dump() for s in spans],
            "native_line_ids": [line for p in pieces for line in p.native_line_ids],
        }
    )
    # Rehome retained native hashes without rediscovering repeated line text.
    mappings = {}
    for piece in pieces:
        for line_id in piece.native_line_ids:
            entry = state.native_line_maps.get(line_id)
            if entry is None:
                continue
            if (
                entry.segment_id != piece.id
                or hashlib.sha256(piece.text[entry.start : entry.end].encode()).hexdigest()
                != entry.text_sha256
            ):
                raise ValueError("Compound heading native line ownership changed")
            at = offsets[piece.id]
            mappings[line_id] = entry.model_copy(
                update={
                    "segment_id": first.id,
                    "start": entry.start + at,
                    "end": entry.end + at,
                }
            )
    state.compound_heading_sources[first.id] = tuple(pieces)
    state.native_line_maps.update(mappings)
    state.evidence[first.id] = evidence
    for piece in pieces[1:]:
        state.aliases[piece.id] = (first.id, offsets[piece.id])
    state.segments[first.id] = joined
    # Source block alignment/spacing is retained in the private components and
    # region evidence. An ordinary reflowable H1 cannot reproduce hanging layout.
    if any(
        (getattr(p.style, field) if p.style else None)
        != (getattr(first.style, field) if first.style else None)
        for p in pieces[1:]
        for field in LAYOUT_FIELDS
    ) or any(
        span.style is not None and getattr(span.style, field) is not None
        for p in pieces
        for span in p.spans
        for field in LAYOUT_FIELDS
    ):
        state.structure_findings.append(
            Finding(
                code="COMPOUND_HEADING_LAYOUT_REFLOWED",
                severity="information",
                page=first.page,
                block_id=first.id,
                box=box,
                message="Source title fragments form one reflowable heading. Text, font runs and "
                "source regions are retained; independent line alignment and spacing "
                "are not reproduced.",
            )
        )
    return joined
