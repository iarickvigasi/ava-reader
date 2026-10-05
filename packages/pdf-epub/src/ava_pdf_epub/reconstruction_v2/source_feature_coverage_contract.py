"""Private finite comparison provenance and report coverage; no text is stored here."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.source import Box
from .source_feature_contract import Feature, FeatureValue


class SourceFeatureEvidence(Record):
    node_id: Id
    canonical_block_id: Id | None = None
    canonical_start: int | None = Field(default=None, ge=0, le=200000)
    text_length: int = Field(ge=0, le=200000)
    page: int = Field(ge=1, le=500)
    box: Box
    text_sha256: Digest
    feature: Feature
    disposition: Literal["observed", "unknown", "not_applicable"]
    value: FeatureValue
    reason: (
        Literal[
            "source_blurred",
            "source_clipped",
            "source_context_insufficient",
            "heading_has_no_prose_first_line",
            "comparison_budget_bound",
            "source_context_unavailable",
        ]
        | None
    )
    task_id: Id | None
    task_sha256: Digest | None
    response_sha256: Digest | None
    observation_sha256: Digest
    source_sha256: Digest
    crop_ids: list[Id] = Field(max_length=4)
    crop_sha256: Digest | None

    @model_validator(mode="after")
    def provenance(self) -> "SourceFeatureEvidence":
        uninspected = self.reason in {"comparison_budget_bound", "source_context_unavailable"}
        pins = [self.task_id, self.task_sha256, self.response_sha256, self.crop_sha256]
        if uninspected:
            if (
                self.disposition != "unknown"
                or self.value is not None
                or any(v is not None for v in pins)
                or self.crop_ids
            ):
                raise ValueError("Uninspected feature cannot manufacture comparison evidence")
        elif (
            any(v is None for v in pins)
            or len(self.crop_ids) < 2
            or len(set(self.crop_ids)) != len(self.crop_ids)
        ):
            raise ValueError(
                "Inspected feature requires complete immutable crop/response provenance"
            )
        return self


class SourceFeatureCoverage(Record):
    policy_id: Literal["ava-ocr-source-features-1"]
    requested_features: int = Field(ge=0, le=1792)
    inspected_features: int = Field(ge=0, le=1792)
    uninspected_features: int = Field(ge=0, le=1792)
    unrequested_optional_candidates: int = Field(ge=0, le=1000000)
    evidence: list[SourceFeatureEvidence] = Field(max_length=1792)

    @model_validator(mode="after")
    def finite_coverage(self) -> "SourceFeatureCoverage":
        identities = {(e.node_id, e.feature) for e in self.evidence}
        if len(identities) != len(self.evidence) or len(identities) != self.requested_features:
            raise ValueError("Finite source feature coverage differs")
        inspected = sum(e.task_id is not None for e in self.evidence)
        if (
            self.inspected_features != inspected
            or self.uninspected_features != self.requested_features - inspected
        ):
            raise ValueError("Feature comparison counts differ from actual provenance")
        if any(e.canonical_block_id is None or e.canonical_start is None for e in self.evidence):
            raise ValueError("Feature report lacks final canonical range bindings")
        if any(
            e.feature == "paragraph_role" and e.disposition != "observed" for e in self.evidence
        ):
            raise ValueError("Essential source role remains unqualified")
        return self
