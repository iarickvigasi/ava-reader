"""Translate both legacy exception and failed-validation exits without raw error echo."""

from pathlib import Path
from typing import Any

from .job import JobInputV1
from .legacy_binding import LegacyInvocation
from .legacy_candidate import candidate
from .private_files import describe
from .results import FailureOutcome


def failure(
    job: JobInputV1, binding: LegacyInvocation, root: Path, report: dict[str, Any]
) -> FailureOutcome:
    if report.get("status") != "failed":
        assembly = report.get("assembly")
        checks = report.get("checks")
        if not isinstance(assembly, dict) or not isinstance(checks, dict):
            raise ValueError("Failure result must be explicit")
        check = checks.get("epubcheck")
        if not (
            assembly.get("export_valid") is False
            or isinstance(check, dict)
            and check.get("status") == "fail"
        ):
            raise ValueError("Failure result must be explicit")
        candidate(job, binding, root, report, 2)
    return FailureOutcome.model_validate(
        dict(
            status="failed",
            cli_exit_code=1,
            failure_id="legacy-" + binding.legacy_job_id,
            code="LEGACY_WORKER_FAILED",
            stage="validation",
            safe_reason="The conversion could not be completed.",
            diagnostic=describe(root, binding.result_path, "DIAGNOSTIC", "legacy-diagnostic"),
            investigation_required=True,
            notification_required=True,
            reader_retry_allowed=False,
        )
    )
