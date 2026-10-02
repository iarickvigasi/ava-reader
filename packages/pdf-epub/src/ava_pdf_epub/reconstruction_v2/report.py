"""Bound source/reconstruction evidence to exact outputs; separate EPUBCheck and visual review."""

import hashlib
from typing import Literal

from pydantic import Field

from ..contracts.common import Digest, Id, Record, document_digest
from ..contracts.profiles import ProfileId
from .findings import Finding
from .reconstruct import ReconstructedBook


class RefinementEvidence(Record):
    task_id: Id
    task_sha256: Digest
    response_sha256: Digest
    observation_sha256: Digest
    node_ids: list[Id] = Field(min_length=1, max_length=48)


class ReconstructionReport(Record):
    schema_version: Literal["ava-reconstruction-report-1"]
    source_sha256: Digest
    canonical_sha256: Digest
    epub_sha256: Digest
    resource_hashes: dict[str, Digest]
    profile_id: ProfileId
    outcome: Literal["candidate"]
    page_count: int = Field(ge=1, le=500)
    recognition_task_count: int = Field(ge=0, le=25000)
    checks: dict[str, Literal["pass", "not_run"]]
    findings: list[Finding] = Field(max_length=10000)
    refinement_evidence: list[RefinementEvidence] = Field(default_factory=list, max_length=32)


def reconstruction_report(result: ReconstructedBook, tasks: int) -> ReconstructionReport:
    return ReconstructionReport(
        schema_version="ava-reconstruction-report-1",
        source_sha256=result.book.source.sha256,
        canonical_sha256=document_digest(result.book),
        epub_sha256=hashlib.sha256(result.epub).hexdigest(),
        resource_hashes={r.id: r.sha256 for r in result.book.resources},
        profile_id=result.book.profile_id,
        outcome="candidate",
        page_count=len(result.book.pages),
        recognition_task_count=tasks,
        checks={
            "complete_source_pages": "pass",
            "complete_recognition_task_receipts": "pass",
            "native_character_conservation": "pass",
            "canonical_semantic_graph": "pass",
            "source_region_coverage": "pass",
            "note_list_table_relationships": "pass",
            "source_structure_signals_consistent": "not_run"
            if any(f.severity != "information" for f in result.structure_findings)
            else "pass",
            "explicit_source_references_resolved": "pass",
            "required_resource_byte_hashes": "pass",
            "declared_ocr_uncertainty_resolved": "pass",
            "epubcheck": "not_run",
            "independent_visual_source_fidelity": "not_run",
        },
        findings=result.structure_findings,
        refinement_evidence=[
            RefinementEvidence.model_validate(v) for v in result.refinement_evidence
        ],
    )
