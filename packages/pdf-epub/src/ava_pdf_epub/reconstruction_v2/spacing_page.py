"""Current-policy spacing correction precedes all native source maps and task identities."""

from pathlib import Path
from typing import Any

from pypdf import PdfReader

from .font_mapping_source import direct_type1_mapping
from .geometry import overlap
from .observations import PageObservation
from .spacing_capture import capture_spacing
from .spacing_decoder import spacing_proposals
from .spacing_line import qualify_line_spaces


def qualify_page_spaces(
    source: Path, page: Any, reader: PdfReader, observation: PageObservation
) -> PageObservation:
    original = reader.pages[observation.number - 1]
    crop = [float(v) for v in original.cropbox]
    if (
        observation.risks
        or observation.required_regions
        or observation.rotation
        or not observation.lines
        or crop != list(original.mediabox)
        or crop[:2] != [0, 0]
        or original.rotation != 0
        or not direct_type1_mapping(original, reader)
        or any(overlap(g.box, line.box) for g in observation.graphics for line in observation.lines)
    ):
        return observation
    try:
        metrics = capture_spacing(page)
        lines = []
        unresolved = False
        proposals = spacing_proposals(source, observation)
        for line, proposed in zip(observation.lines, proposals, strict=True):
            changed, ambiguous = qualify_line_spaces(line, proposed, metrics)
            lines.append(changed)
            unresolved |= ambiguous
        return observation.model_copy(
            update={
                "lines": lines,
                "risks": [*observation.risks, "native_spacing_unresolved"]
                if unresolved
                else observation.risks,
            }
        )
    except (ImportError, AttributeError, OSError, RuntimeError, UnicodeError):
        # A missing/failed corroborator cannot silently certify the old spacing.
        return observation.model_copy(
            update={"risks": [*observation.risks, "native_spacing_unavailable"]}
        )
