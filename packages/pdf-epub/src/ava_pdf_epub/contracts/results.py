"""Worker output can retain a candidate or terminal failure, never publish Ready."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from .artifacts import Artifact, bound_artifacts, distinct_artifacts, require_role
from .common import Digest, Id, Record


class CandidateOutcome(Record):
    status: Literal["candidate"]
    cli_exit_code: Literal[0, 2]
    canonical_schema: Literal["ava-book-1", "ava-book-2"]
    publication_eligible: Literal[False]
    candidate_id: Id
    canonical_book: Artifact
    epub: Artifact
    validation_report: Artifact
    resources: list[Artifact] = Field(max_length=1000)
    finding_codes: list[Annotated[str, Field(pattern=r"^[A-Z][A-Z0-9_]{0,79}$")]] = Field(
        max_length=1000
    )

    @model_validator(mode="after")
    def candidate_roles(self) -> Self:
        require_role(self.canonical_book, "CANONICAL_BOOK")
        require_role(self.epub, "DERIVED_EPUB")
        require_role(self.validation_report, "VALIDATION_REPORT")
        for resource in self.resources:
            require_role(resource, "RESOURCE")
        distinct_artifacts(
            [self.canonical_book, self.epub, self.validation_report, *self.resources]
        )
        bound_artifacts([self.canonical_book, self.epub, self.validation_report, *self.resources])
        return self


class FailureOutcome(Record):
    status: Literal["failed", "unsupported"]
    cli_exit_code: Literal[1]
    failure_id: Id
    code: str = Field(pattern=r"^[A-Z][A-Z0-9_]{0,79}$", max_length=80)
    stage: Literal["preflight", "extraction", "reconstruction", "assembly", "validation"]
    safe_reason: str = Field(min_length=1, max_length=500)
    diagnostic: Artifact
    investigation_required: Literal[True]
    notification_required: Literal[True]
    reader_retry_allowed: Literal[False]

    @model_validator(mode="after")
    def diagnostic_role(self) -> Self:
        require_role(self.diagnostic, "DIAGNOSTIC")
        return self


class WorkerResultV1(Record):
    schema_version: Literal["ava-pdf-worker-result-1"]
    operation_id: Id
    source_sha256: Digest
    request_sha256: Digest
    config_sha256: Digest
    worker_fingerprint: Digest
    profile_id: Literal["ava-pdf-prose-en-v2"]
    generation: int = Field(ge=1, le=9007199254740991)
    attempt_fence: int = Field(ge=1, le=9007199254740991)
    cancellation_epoch: int = Field(ge=0, le=9007199254740991)
    outcome: Annotated[CandidateOutcome | FailureOutcome, Field(discriminator="status")]
