"""Rebuild generated inherited runs after a source-backed compound base correction."""

from typing import Any

from ..contracts.styles import Style
from .assembly_state import AssemblyState
from .compound_heading_styles import INLINE_FIELDS, heading_spans
from .segments import Segment


def compound_style_update(segment: Segment, state: AssemblyState) -> Segment:
    pieces = state.compound_heading_sources.get(segment.id)
    if not pieces:
        return segment
    old, new = pieces[0].style, segment.style
    if new is None:
        raise ValueError("Compound heading appearance lost its base style")
    spans, cursor = [], 0
    for piece in pieces:
        values: dict[str, Any] = (
            piece.style.model_dump() if piece.style else {"id": "compound-source"}
        )
        for field in INLINE_FIELDS:
            original = getattr(piece.style, field) if piece.style else None
            baseline = getattr(old, field) if old else None
            # Only fields inherited from the common base follow its correction.
            # Distinct component styles and explicit source spans retain authority.
            if original == baseline:
                values[field] = getattr(new, field)
        old_size = old.relative_size if old else None
        source_size = piece.style.relative_size if piece.style else None
        if old_size != new.relative_size:
            if old_size is None or source_size is None or new.relative_size is None:
                raise ValueError("Compound heading size correction lacks source proportions")
        revised = piece.model_copy(update={"style": Style.model_validate(values)})
        # A corrected block baseline scales the existing source proportions.
        # Validate final relative runs, not an invented absolute component Style
        # (block 2em × span 3em is legal even though a transient 6em Style is not).
        run_base = new.model_copy(update={"relative_size": old_size})
        spans.extend(heading_spans(revised, run_base, cursor))
        cursor += len(piece.text) + 1
    if segment.text != "\n".join(p.text for p in pieces):
        raise ValueError("Compound heading appearance cannot rewrite source components")
    return Segment.model_validate(
        {**segment.model_dump(), "spans": [s.model_dump() for s in spans]}
    )
