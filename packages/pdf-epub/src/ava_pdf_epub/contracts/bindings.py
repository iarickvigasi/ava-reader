"""Context-dependent integrity checks; only the server can grant execution/publication."""

from .accepted import AcceptedContentV1
from .artifacts import bound_artifacts
from .job import JobInputV1
from .results import CandidateOutcome, WorkerResultV1


def validate_result_for_job(job: JobInputV1, result: WorkerResultV1) -> None:
    job = JobInputV1.model_validate(job.model_dump())
    result = WorkerResultV1.model_validate(result.model_dump())
    fields = (
        "operation_id",
        "request_sha256",
        "config_sha256",
        "worker_fingerprint",
        "profile_id",
        "generation",
        "attempt_fence",
        "cancellation_epoch",
    )
    if result.source_sha256 != job.source.sha256 or any(
        getattr(job, key) != getattr(result, key) for key in fields
    ):
        raise ValueError("Worker result does not belong to this exact job attempt")
    outcome = result.outcome
    artifacts = (
        [outcome.canonical_book, outcome.epub, outcome.validation_report, *outcome.resources]
        if isinstance(outcome, CandidateOutcome)
        else [outcome.diagnostic]
    )
    bound_artifacts(artifacts, job.scratch_byte_limit)


def validate_accepted_binding(
    accepted: AcceptedContentV1, job: JobInputV1, result: WorkerResultV1
) -> None:
    validate_result_for_job(job, result)
    accepted = AcceptedContentV1.model_validate(accepted.model_dump())
    if (
        not isinstance(result.outcome, CandidateOutcome)
        or result.outcome.canonical_schema != "ava-book-2"
    ):
        raise ValueError("Only a version2 canonical candidate can bind accepted content")
    if any(
        getattr(accepted, key) != getattr(job, key)
        for key in (
            "operation_id",
            "owner_id",
            "library_item_id",
            "profile_id",
            "config_sha256",
            "cancellation_epoch",
        )
    ):
        raise ValueError("Accepted identity does not belong to its initial import")
    if accepted.source != job.source:
        raise ValueError("Accepted source differs from original PDF")
    if any(
        getattr(accepted, key) != getattr(result.outcome, key)
        for key in ("canonical_book", "epub", "validation_report", "resources")
    ):
        raise ValueError("Accepted artifacts differ from the exact candidate")
