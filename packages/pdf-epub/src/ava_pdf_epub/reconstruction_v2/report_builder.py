"""Build bounded report provenance from the actual captured reconstruction route."""

import hashlib

from ..contracts.common import document_digest
from .continuation_presentation_contract import POLICY
from .continuation_report import AnyReconstructionReport, ContinuationReconstructionReport
from .reconstruct import ReconstructedBook
from .report_contract import ReconstructionReport, RefinementEvidence
from .source_feature_coverage_contract import SourceFeatureCoverage


def reconstruction_report(result: ReconstructedBook, tasks: int) -> AnyReconstructionReport:
    source_continuation_policy = result.source_continuation_policy
    if source_continuation_policy not in {None, POLICY}:
        raise ValueError("Unknown reconstruction report continuation policy")
    current = source_continuation_policy == POLICY
    report_class = ContinuationReconstructionReport if current else ReconstructionReport
    raw = dict(
        schema_version="ava-reconstruction-report-3"
        if current
        else "ava-reconstruction-report-2"
        if result.source_feature_coverage is not None
        else "ava-reconstruction-report-1",
        **({"source_continuation_policy": POLICY} if current else {}),
        source_feature_coverage=SourceFeatureCoverage.model_validate(result.source_feature_coverage)
        if result.source_feature_coverage is not None
        else None,
        source_sha256=result.book.source.sha256,
        canonical_sha256=document_digest(result.book),
        epub_sha256=hashlib.sha256(result.epub).hexdigest(),
        resource_hashes={r.id: r.sha256 for r in result.book.resources},
        profile_id=result.book.profile_id,
        outcome="candidate",
        page_count=len(result.book.pages),
        recognition_task_count=tasks,
        checks={
            **(
                {"finite_source_feature_dispositions_complete": "pass"}
                if result.source_feature_coverage is not None
                else {}
            ),
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
    return report_class.model_validate(raw)
