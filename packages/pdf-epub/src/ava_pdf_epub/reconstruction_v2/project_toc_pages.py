"""Bind original source bytes and project only complete witnessed TOC pages before assembly."""

import hashlib
import io
from collections.abc import Sequence
from pathlib import Path

from pypdf import PdfReader

from ..contracts.private_files import snapshot
from ..extract import MAX_SOURCE_BYTES
from .assembly_state import AssemblyState
from .findings import Finding
from .ocr_glyph_frame import glyph_frame_safe
from .prepared_types import AnyPreparedPage
from .segments import Segment
from .toc_page_projection import toc_page_projection
from .toc_projection_receipt import toc_projection_receipt
from .toc_projection_task import toc_projection_task


def project_toc_pages(
    source: Path,
    scratch: Path,
    prepared: Sequence[AnyPreparedPage],
    qualified: dict[int, list[Segment]],
    state: AssemblyState,
) -> dict[int, list[Segment]]:
    policy = state.source_continuation_policy
    selected = [
        (p, task)
        for p in prepared
        if (task := toc_projection_task(p, qualified[p.observation.number], policy))
    ]
    if not selected or len({p.observation.number for p in prepared}) != len(prepared):
        return qualified
    raw = snapshot(source.parent, source.name, MAX_SOURCE_BYTES)
    digest = hashlib.sha256(raw).hexdigest()
    output = dict(qualified)
    with PdfReader(io.BytesIO(raw), strict=True) as reader:
        if reader.is_encrypted:
            return qualified
        for checkpoint, task in selected:
            page = checkpoint.observation
            if (
                checkpoint.source_sha256 != digest
                or checkpoint.source_byte_length != len(raw)
                or checkpoint.source_page_count != len(reader.pages)
                or not 1 <= page.number <= len(reader.pages)
                or not glyph_frame_safe(reader.pages[page.number - 1], page)
            ):
                continue
            try:
                projections = toc_page_projection(reader, page, qualified[page.number], policy)
            except (ValueError, TypeError, KeyError, IndexError):
                continue
            if projections is None:
                continue
            receipt = toc_projection_receipt(scratch, checkpoint, task, projections, policy)
            output[page.number] = [p.owner for p in projections]
            state.structure_findings.append(
                Finding(
                    code="OCR_TOC_GEOMETRY_SOURCE_CORROBORATED",
                    severity="information",
                    page=page.number,
                    message=f"Complete original TOC geometry; private receipt {receipt}",
                )
            )
    return output
