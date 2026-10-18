"""Independent source cadence can corroborate one OCR metric before finite crop review."""

import hashlib
import io
import os
from collections import Counter, defaultdict
from collections.abc import Sequence
from pathlib import Path

import pdfplumber
from pypdf import PdfReader

from ..contracts.common import Record, document_digest, text_digest
from ..contracts.styles import Style
from .assembly_state import AssemblyState
from .continuation_boundary import JOIN_STYLE
from .continuation_metric_rows import cadence, metric_rows
from .continuation_metric_source import source_metric_face
from .continuation_presentation_contract import POLICY
from .findings import Finding
from .glyph_owner_structure import glyph_owner_structure
from .prepared_types import AnyPreparedPage
from .refinement_edges import refinement_edges
from .segments import Segment


class SourceMetricProof(Record):
    schema_version: str = "ava-source-continuation-metric-1"
    source_sha256: str
    edge_id: str
    native_id: str
    ocr_id: str
    native_segment_sha256: str
    ocr_segment_sha256: str
    native_observation_sha256: str
    ocr_observation_sha256: str
    native_text_sha256: str
    ocr_text_sha256: str
    original_native_style: Style
    original_ocr_style: Style
    corrected_ocr_style: Style
    native_rows: tuple[str, ...]
    ocr_rows: tuple[str, ...]
    skipped_terminal_hyphens: tuple[tuple[str, int], ...]
    font_resource: tuple[int, int, float, tuple[float, ...]]
    native_gaps: tuple[float, ...]
    ocr_gaps: tuple[float, ...]
    native_median: float
    ocr_median: float
    arithmetic_error_bound: float


def uniform_spans(segment: Segment) -> bool:
    if segment.style is None:
        return False
    return all(
        value == getattr(segment.style, key)
        for span in segment.spans
        if span.style is not None
        for key, value in span.style.model_dump(exclude={"id"}, exclude_none=True).items()
    )


def eligible_pair(native: Segment, ocr: Segment) -> bool:
    if any(
        s.kind != "paragraph"
        or s.structure_candidate
        or s.preserve_line_breaks
        or s.style is None
        or not uniform_spans(s)
        for s in (native, ocr)
    ):
        return False
    assert native.style and ocr.style
    if (
        native.style.line_height is None
        or ocr.style.line_height is None
        or native.style.line_height == ocr.style.line_height
    ):
        return False
    # Other known conflicts remain unresolved. This proof measures only cadence;
    # unknown reset/alignment fields still need the existing two-crop comparison.
    return not any(
        getattr(native.style, k) is not None
        and getattr(ocr.style, k) is not None
        and getattr(native.style, k) != getattr(ocr.style, k)
        for k in JOIN_STYLE - {"line_height", "space_after_em", "align"}
    )


def corroborate_continuation_metrics(
    source: Path,
    scratch: Path,
    prepared: Sequence[AnyPreparedPage],
    segments: list[Segment],
    state: AssemblyState,
) -> list[Segment]:
    if state.source_continuation_policy != POLICY:
        return segments
    owners = {s.id: s for s in segments}
    if len(owners) != len(segments):
        return segments
    pairs = []
    for edge in refinement_edges(segments, state):
        ends = [owners[edge.previous_id], owners[edge.next_id]]
        if {s.method for s in ends} == {"native", "ocr"}:
            native = next(s for s in ends if s.method == "native")
            ocr = next(s for s in ends if s.method == "ocr")
            if eligible_pair(native, ocr):
                pairs.append((edge, native, ocr))
    if not pairs:
        return segments
    raw = source.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    reader = PdfReader(io.BytesIO(raw), strict=True)
    pages = {p.observation.number: p for p in prepared}
    if len(pages) != len(prepared):
        return segments
    proofs: dict[str, list[SourceMetricProof]] = defaultdict(list)
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        for edge, native, ocr in pairs:
            endpoints = []
            for owner in (native, ocr):
                checkpoint = pages.get(owner.page)
                if (
                    checkpoint is None
                    or checkpoint.source_sha256 != digest
                    or checkpoint.source_byte_length != len(raw)
                    or checkpoint.source_page_count != len(reader.pages)
                ):
                    break
                page = checkpoint.observation
                if set(page.risks) - {
                    "language_uncertain",
                    "native_spacing_unresolved",
                    "native_spacing_unavailable",
                }:
                    break
                if owner.method == "ocr" and not glyph_owner_structure(page, owner, segments):
                    break
                if owner.method == "native" and (page.required_regions or page.graphics):
                    break  # Keep this metric proof narrower than native text qualification.
                proved = metric_rows(page, owner, segments)
                if proved is None:
                    break
                rows, skipped = proved
                parsed = pdf.pages[owner.page - 1]
                try:
                    face = source_metric_face(reader, parsed.chars, page, rows, owner)
                finally:
                    parsed.close()  # Keep only one fresh character page resident at a time.
                measured = cadence(rows, face[2]) if face is not None else None
                if face is None or measured is None:
                    break
                endpoints.append((page, rows, skipped, face, measured))
            if len(endpoints) != 2:
                continue
            a, b = endpoints
            measured_native, measured_ocr = a[4], b[4]
            assert native.style and ocr.style
            if (
                a[3] != b[3]
                or native.style.line_height != measured_native[0]
                or abs(measured_native[0] - measured_ocr[0]) > measured_native[2] + measured_ocr[2]
            ):
                continue
            corrected = ocr.style.model_copy(update={"line_height": native.style.line_height})
            if not uniform_spans(ocr.model_copy(update={"style": corrected})):
                continue  # Unchanged inline metrics must not contradict the corrected base.
            proofs[ocr.id].append(
                SourceMetricProof(
                    source_sha256=digest,
                    edge_id=edge.id,
                    native_id=native.id,
                    ocr_id=ocr.id,
                    native_segment_sha256=document_digest(native),
                    ocr_segment_sha256=document_digest(ocr),
                    native_observation_sha256=document_digest(a[0]),
                    ocr_observation_sha256=document_digest(b[0]),
                    native_text_sha256=text_digest(native.text),
                    ocr_text_sha256=text_digest(ocr.text),
                    original_native_style=native.style,
                    original_ocr_style=ocr.style,
                    corrected_ocr_style=corrected,
                    native_rows=tuple(r.id for r in a[1]),
                    ocr_rows=tuple(r.id for r in b[1]),
                    skipped_terminal_hyphens=a[2] + b[2],
                    font_resource=a[3],
                    native_gaps=measured_native[1],
                    ocr_gaps=measured_ocr[1],
                    native_median=measured_native[0],
                    ocr_median=measured_ocr[0],
                    arithmetic_error_bound=measured_native[2] + measured_ocr[2],
                )
            )
    updates = {}
    counts = Counter(s.id for s in segments)
    for ident, records in proofs.items():
        if counts[ident] != 1 or len({r.corrected_ocr_style.line_height for r in records}) != 1:
            continue  # Competing native sources must never be resolved by iteration order.
        owner = owners[ident]
        for proof in records:
            wire = proof.model_dump_json().encode()
            checksum = hashlib.sha256(wire).hexdigest()
            folder = scratch / "continuation-metrics"
            folder.mkdir(mode=0o700, exist_ok=True)
            target = folder / (checksum + ".json")
            try:
                fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            except FileExistsError:
                if target.read_bytes() != wire:
                    raise ValueError("Source metric evidence collision") from None
            else:
                with os.fdopen(fd, "wb") as stream:
                    stream.write(wire)
            prior = state.continuation_metric_proofs.get(checksum)
            if prior is not None:
                if prior != proof:
                    raise ValueError("Source metric evidence identity differs")
                continue
            state.continuation_metric_proofs[checksum] = proof
            state.structure_findings.append(
                Finding(
                    code="OCR_CONTINUATION_LEADING_SOURCE_CORROBORATED",
                    severity="information",
                    page=owner.page,
                    block_id=ident,
                    box=owner.box,
                    message=(
                        f"Complete exclusive source rows, identical font resource/transform and "
                        f"baseline measurements corroborate leading {proof.native_median!r}; "
                        f"original OCR estimate {proof.original_ocr_style.line_height!r}. "
                        f"Native owner {proof.native_id}; private proof SHA256 {checksum}. "
                        "Text, spans and geometry are unchanged. "
                        "This grants no text/offset or join authority."
                    ),
                )
            )
        updates[ident] = owner.model_copy(update={"style": records[0].corrected_ocr_style})
    return [updates.get(s.id, s) for s in segments]
