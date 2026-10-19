"""Bound source/reconstruction evidence to exact outputs; separate EPUBCheck and visual review."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.profiles import ProfileId
from .findings import Finding
from .source_feature_coverage_contract import SourceFeatureCoverage


class RefinementEvidence(Record):
    task_id: Id
    task_sha256: Digest
    response_sha256: Digest
    observation_sha256: Digest
    node_ids: list[Id] = Field(min_length=1, max_length=48)


class ReconstructionReport(Record):
    schema_version: Literal["ava-reconstruction-report-1", "ava-reconstruction-report-2"]
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
    source_feature_coverage: SourceFeatureCoverage | None = Field(
        default=None, exclude_if=lambda v: v is None
    )

    @model_validator(mode="after")
    def feature_authority(self) -> "ReconstructionReport":
        current = self.schema_version != "ava-reconstruction-report-1"
        if current != (self.source_feature_coverage is not None):
            raise ValueError("Report source-feature policy authority differs")
        if not current and "finite_source_feature_dispositions_complete" in self.checks:
            raise ValueError("Historical report cannot claim current feature coverage")
        if current and self.checks.get("finite_source_feature_dispositions_complete") != "pass":
            raise ValueError("Current report lacks exact finite feature coverage")
        return self
