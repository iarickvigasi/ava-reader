"""Derive boxes before assembly, preserving the original OCR text and raw-box receipt."""

from ..contracts.common import document_digest
from .geometry import overlap, union
from .index_projection_eligibility import index_projection_task
from .index_projection_types import IndexOwnerProjection, IndexPageProjection
from .index_row_partition import index_row_partition
from .index_source_rows import index_source_rows
from .ocr_literal_glyph_map import literal_fragment_map
from .prepared_types import AnyPreparedPage
from .segments import Segment
from .source_context_identity import source_context_identity


def index_page_projection(
    checkpoint: AnyPreparedPage, owners: list[Segment], policy: str | None
) -> tuple[list[Segment], IndexPageProjection] | None:
    task = index_projection_task(checkpoint, owners, policy)
    if task is None:
        return None
    page = checkpoint.observation
    rows = index_source_rows(page, checkpoint.profile_id)
    body = [s for s in owners if s.kind == "paragraph"]
    partition = index_row_partition(rows, body) if rows else None
    if partition is None:
        return None
    projected = {
        owner.id: owner.model_copy(update={"box": union([r.box for r in selected])})
        for owner, selected in partition
    }
    current = [projected.get(s.id, s) for s in owners]
    if any(
        overlap(row.box, s.box)
        for row in rows or []
        for s in current
        if s.kind != "paragraph" and s.kind != "furniture"
    ):
        return None
    entries = []
    for raw, selected in partition:
        owner = projected[raw.id]
        fragments = [(r.line, list(r.values)) for r in selected]
        proof = literal_fragment_map(page, owner, current, fragments)
        if proof is None:
            return None
        entries.append(
            IndexOwnerProjection(
                source_context_identity(raw),
                raw.box,
                source_context_identity(owner),
                proof,
                selected,
            )
        )
    receipt = IndexPageProjection(
        document_digest(page),
        checkpoint.source_sha256,
        document_digest(task),
        tuple((s.id, source_context_identity(s)) for s in current if s.kind != "furniture"),
        tuple((s.id, source_context_identity(s)) for s in current if s.kind == "furniture"),
        tuple(entries),
    )
    return current, receipt
