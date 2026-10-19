"""Wrap the private native engine; its SQLite state is attempt scratch, not server authority."""

import json
import sqlite3
from pathlib import Path

from ..contracts.common import document_digest
from ..contracts.job import JobInputV1
from ..contracts.legacy_result import LegacyInvocation, adapt_legacy_result
from ..contracts.results import WorkerResultV1
from ..pipeline import run_conversion


def native_candidate(job: JobInputV1, root: Path) -> WorkerResultV1:
    request_key = f"{job.operation_id}:{job.attempt_fence}"
    report = run_conversion(
        source=root / "source.pdf",
        work_dir=root / "work",
        owner=job.owner_id,
        request_key=request_key,
        timeout=job.active_deadline_seconds,
    )
    result_bytes = json.dumps(report, ensure_ascii=False).encode()
    (root / "captured.json").write_bytes(result_bytes)
    with sqlite3.connect((root / "work/state.sqlite3").as_uri() + "?mode=ro", uri=True) as db:
        row = db.execute(
            "SELECT id, source_sha256, config_sha256, lease_fence FROM jobs "
            "WHERE owner_id=? AND request_key=?",
            (job.owner_id, request_key),
        ).fetchone()
    if row is None or row[1] != job.source.sha256 or row[3] != 1:
        raise ValueError("Private execution identity mismatch")
    binding = LegacyInvocation(
        job_sha256=document_digest(job),
        legacy_job_id=row[0],
        legacy_config_sha256=row[2],
        attempt_path=f"work/jobs/{row[0]}/attempt-1",
        result_path="captured.json",
    )
    code = 2 if report["assembly"]["export_valid"] else 1
    return adapt_legacy_result(
        job,
        binding=binding,
        exit_code=code,
        result_bytes=result_bytes,
        artifact_root=root,
    )
