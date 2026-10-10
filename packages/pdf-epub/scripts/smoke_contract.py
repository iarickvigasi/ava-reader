"""Bind actual native CLI output to independent private invocation state for contract smoke."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.contracts.fingerprint import installed_package_fingerprint
from ava_pdf_epub.contracts.job import JobInputV1
from ava_pdf_epub.contracts.legacy_result import LegacyInvocation, adapt_legacy_result


def write_envelope(root: Path) -> None:
    source = root / "native-smoke.pdf"
    source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
    with sqlite3.connect((root / "work/state.sqlite3").as_uri() + "?mode=ro", uri=True) as db:
        row = db.execute(
            "SELECT id, source_sha256, config_sha256, cancellation_epoch FROM jobs "
            "WHERE owner_id=? AND request_key=?",
            ("synthetic-smoke", "initial-import"),
        ).fetchone()
    if row is None or row[1] != source_sha:
        raise ValueError("Private invocation source is missing or mismatched")
    request = {"owner": "synthetic-smoke", "request_key": "initial-import", "source": source_sha}
    job = JobInputV1.model_validate(
        {
            "schema_version": "ava-pdf-job-1",
            "operation_id": "smoke-import",
            "owner_id": "synthetic-smoke",
            "library_item_id": "smoke-book",
            "intent": "initial_pdf_import",
            "profile_id": "ava-pdf-prose-en-v2",
            "source": {
                "id": "source-pdf",
                "role": "SOURCE_PDF",
                "format": "PDF",
                "media_type": "application/pdf",
                "path": source.name,
                "sha256": source_sha,
                "byte_length": source.stat().st_size,
            },
            "request_sha256": hashlib.sha256(
                json.dumps(request, sort_keys=True).encode()
            ).hexdigest(),
            "config_sha256": row[2],
            "worker_fingerprint": installed_package_fingerprint(),
            "generation": 1,
            "attempt_fence": 1,
            "cancellation_epoch": row[3],
            "provider_mode": "native",
            "active_deadline_seconds": 180,
            "source_page_limit": 2,
            "scratch_byte_limit": 104857600,
        }
    )
    binding = LegacyInvocation(
        job_sha256=document_digest(job),
        legacy_job_id=row[0],
        legacy_config_sha256=row[2],
        attempt_path=f"work/jobs/{row[0]}/attempt-1",
        result_path="first.stdout.json",
    )
    envelope = adapt_legacy_result(
        job,
        binding=binding,
        exit_code=2,
        result_bytes=(root / "first.stdout.json").read_bytes(),
        artifact_root=root,
    )
    for name, model in [
        ("contract-job", job),
        ("contract-result", envelope),
        ("contract-binding", binding),
    ]:
        (root / (name + ".json")).write_text(model.model_dump_json(indent=2) + "\n")
    if envelope.outcome.status != "candidate" or envelope.outcome.publication_eligible:
        raise AssertionError("Native smoke must remain a nonpublishable candidate")
