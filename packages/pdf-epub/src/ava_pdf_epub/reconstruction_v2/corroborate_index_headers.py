"""Correct source-witnessed index running headers before preservation and assembly."""

import hashlib
from collections import defaultdict
from collections.abc import Sequence
from pathlib import Path

from pypdf import PdfReader

from .assembly_state import AssemblyState
from .findings import Finding
from .index_header_types import HeaderKey, IndexHeaderWitness
from .index_header_witness import index_header_witness
from .index_projection_eligibility import index_projection_task
from .ocr_glyph_frame import glyph_frame_safe
from .prepared_types import AnyPreparedPage
from .segments import Segment

MIN_HEADER_PAGES = 3


def corroborate_index_headers(
    source: Path,
    prepared: Sequence[AnyPreparedPage],
    qualified: dict[int, list[Segment]],
    state: AssemblyState,
) -> dict[int, list[Segment]]:
    selected = [
        p
        for p in prepared
        if index_projection_task(
            p, qualified[p.observation.number], state.source_continuation_policy
        )
        is not None
    ]
    if not selected:
        return qualified
    with source.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    groups: dict[HeaderKey, list[IndexHeaderWitness]] = defaultdict(list)
    reader = PdfReader(source, strict=True)
    try:
        for checkpoint in selected:
            page = checkpoint.observation
            if (
                checkpoint.source_sha256 != digest
                or page.number > len(reader.pages)
                or not glyph_frame_safe(reader.pages[page.number - 1], page)
            ):
                continue
            owners = qualified[page.number]
            for owner in owners:
                witness = index_header_witness(checkpoint, owner, owners)
                if witness is not None:
                    groups[witness.key].append(witness)
    finally:
        reader.close()
    confirmed: set[str] = set()
    for entries in groups.values():
        if (
            len(entries) >= MIN_HEADER_PAGES
            and len({e.owner.page for e in entries}) == len(entries)
            and any(e.owner.kind == "furniture" for e in entries)
        ):
            confirmed.update(e.owner.id for e in entries if e.owner.kind == "heading")
    if not confirmed:
        return qualified
    output: dict[int, list[Segment]] = {}
    for number, owners in qualified.items():
        output[number] = []
        for owner in owners:
            if owner.id in confirmed:
                owner = owner.model_copy(update={"kind": "furniture", "heading_level": None})
                state.structure_findings.append(
                    Finding(
                        code="OCR_INDEX_RUNNING_HEADER_CORROBORATED",
                        severity="information",
                        page=number,
                        block_id=owner.id,
                        box=owner.box,
                        message="Complete small marginal source text, font and geometry agree "
                        "across at least three same-parity index pages and a furniture peer.",
                    )
                )
            output[number].append(owner)
    return output
