"""Recreate source-qualified assembly observations before any model refinement is applied."""

from pathlib import Path
from typing import Any

from .assemble_pages import assemble_pages
from .assembly_state import AssemblyState
from .continuation_margins import continuation_margins
from .prepared import PreparedPage
from .qualify_pages import qualify_pages
from .recognition_contract import RecognitionResponse
from .segments import Segment
from .source_structure import source_structure


def source_segments(
    source: Path, scratch: Path, prepared: list[PreparedPage], responses: list[RecognitionResponse]
) -> tuple[list[dict[str, Any]], list[Segment], AssemblyState]:
    qualified = qualify_pages(source, scratch, prepared, responses)
    state = AssemblyState()
    pages, segments = assemble_pages(prepared, qualified, state)
    segments = source_structure(source, prepared, qualified, segments, state)
    continuation_margins(segments, prepared, scratch, state)
    return pages, segments, state
