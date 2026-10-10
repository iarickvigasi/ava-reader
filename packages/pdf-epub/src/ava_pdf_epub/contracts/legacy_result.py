"""Adapt a captured native CLI result using trusted invocation and private-root inputs.

This verifies stored identity/integrity, not page fidelity, EPUB quality or publication.
No provider is called, no schema-v1 content is silently migrated, and no files are written.
"""

import hashlib
from pathlib import Path

from .artifact_bytes import verify_artifact_bytes
from .bindings import validate_result_for_job
from .common import MAX_WIRE_BYTES
from .job import JobInputV1
from .legacy_binding import LegacyInvocation
from .legacy_candidate import candidate
from .legacy_failure import failure
from .private_files import snapshot
from .results import CandidateOutcome, FailureOutcome, WorkerResultV1
from .wire import decode_wire

__all__ = ["LegacyInvocation", "adapt_legacy_result"]


def adapt_legacy_result(
    job: JobInputV1,
    *,
    binding: LegacyInvocation,
    exit_code: int,
    result_bytes: bytes,
    artifact_root: Path,
) -> WorkerResultV1:
    """Root and binding must come from server-owned invocation state, never result JSON.

    Binding hashes the complete validated job (including supplied deployment identity).
    Native smoke uses installed_package_fingerprint; a deployment can supply its pinned
    image identity. The old engine's top-level fingerprint is not the package identity.
    """
    try:
        job = JobInputV1.model_validate(job.model_dump())
        binding = LegacyInvocation.model_validate(binding.model_dump())
        binding.validate_job(job)
        if not artifact_root.is_absolute() or artifact_root != artifact_root.resolve():
            raise ValueError("Private root must be absolute and canonical")
        if type(exit_code) is not int or exit_code not in {1, 2}:
            raise ValueError("Unknown CLI exit")
        verify_artifact_bytes(artifact_root, job.source)
        report = decode_wire(result_bytes)
        if not isinstance(report, dict) or result_bytes != snapshot(
            artifact_root, binding.result_path, MAX_WIRE_BYTES
        ):
            raise ValueError("Captured result does not match private bytes")
        outcome: CandidateOutcome | FailureOutcome
        if exit_code == 1:
            outcome = failure(job, binding, artifact_root, report)
            if outcome.diagnostic.sha256 != hashlib.sha256(result_bytes).hexdigest():
                raise ValueError("Legacy diagnostic changed during adaptation")
        else:
            outcome = candidate(job, binding, artifact_root, report, exit_code)
        fields = job.model_dump(
            include={
                "operation_id",
                "request_sha256",
                "config_sha256",
                "worker_fingerprint",
                "profile_id",
                "generation",
                "attempt_fence",
                "cancellation_epoch",
            }
        )
        result = WorkerResultV1.model_validate(
            dict(
                schema_version="ava-pdf-worker-result-1",
                source_sha256=job.source.sha256,
                outcome=outcome,
                **fields,
            )
        )
        validate_result_for_job(job, result)
        return result
    except (ValueError, TypeError, KeyError, OSError, RecursionError, OverflowError):
        raise ValueError("Legacy result cannot be adapted") from None
