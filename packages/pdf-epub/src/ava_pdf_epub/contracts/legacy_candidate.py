"""Legacy native candidate integrity; no migration or semantic readiness inference."""

import hashlib
from pathlib import Path
from typing import Any

from ..io import canonical_json
from ..models import Book
from .common import MAX_WIRE_BYTES
from .job import JobInputV1
from .legacy_binding import LegacyInvocation
from .private_files import describe, snapshot
from .results import CandidateOutcome
from .wire import decode_wire


def candidate(
    job: JobInputV1, binding: LegacyInvocation, root: Path, report: dict[str, Any], exit_code: int
) -> CandidateOutcome:
    attempt = binding.attempt_path
    if (
        report.get("schema_version") != "ava-conversion-result-1"
        or report.get("job_id") != binding.legacy_job_id
        or report.get("source_sha256") != job.source.sha256
        or report.get("config_sha256") != binding.legacy_config_sha256
        or report.get("new_api_cost_usd") != 0
    ):
        raise ValueError("Legacy result identity mismatch")
    config = decode_wire(snapshot(root, attempt + "/configuration.json", MAX_WIRE_BYTES))
    if not isinstance(config, dict) or (
        hashlib.sha256(canonical_json(config)).hexdigest() != binding.legacy_config_sha256
        or config.get("mode") != "native"
        or config.get("input_sha256") != job.source.sha256
        or config.get("review") is not None
        or "asset_root" in config
    ):
        raise ValueError("Legacy configuration mismatch")
    retained_bytes = snapshot(root, attempt + "/result.json", MAX_WIRE_BYTES)
    retained = decode_wire(retained_bytes)
    if not isinstance(retained, dict) or type(report.get("reused")) is not bool:
        raise ValueError("Legacy report is not retained")
    if dict(retained, reused=report["reused"]) != report:
        raise ValueError("Legacy report differs from retained result")
    book_bytes = snapshot(root, attempt + "/book.json", MAX_WIRE_BYTES)
    raw_book = decode_wire(book_bytes)
    if not isinstance(raw_book, dict) or raw_book.get("schema_version") != "ava-book-1":
        raise ValueError("Legacy book has unknown schema")
    book = Book.model_validate_json(book_bytes)
    if (
        book.source_sha256 != job.source.sha256
        or book.page_count > job.source_page_limit
        or len(book.assets) > 1000
        or hashlib.sha256(book.model_dump_json().encode()).hexdigest()
        != report.get("book_revision_sha256")
    ):
        raise ValueError("Legacy book identity mismatch")
    epub_path = attempt + "/book.epub"
    if report.get("epub_path") != str(root / epub_path):
        raise ValueError("Legacy EPUB path differs from trusted attempt")
    epub = describe(root, epub_path, "DERIVED_EPUB", "legacy-epub")
    if epub.sha256 != report.get("epub_sha256"):
        raise ValueError("Legacy EPUB hash mismatch")
    resources = []
    for index, asset in enumerate(book.assets):
        resource = describe(
            root,
            attempt + "/assets/" + asset.path,
            "RESOURCE",
            f"legacy-resource-{index}",
            asset.media_type,
        )
        if resource.sha256 != asset.sha256:
            raise ValueError("Legacy resource hash mismatch")
        resources.append(resource)
    book_artifact = describe(root, attempt + "/book.json", "CANONICAL_BOOK", "legacy-book")
    report_artifact = describe(root, attempt + "/result.json", "VALIDATION_REPORT", "legacy-report")
    if (
        book_artifact.sha256 != hashlib.sha256(book_bytes).hexdigest()
        or report_artifact.sha256 != hashlib.sha256(retained_bytes).hexdigest()
    ):
        raise ValueError("Legacy JSON changed during adaptation")
    return CandidateOutcome.model_validate(
        dict(
            status="candidate",
            cli_exit_code=exit_code,
            canonical_schema="ava-book-1",
            publication_eligible=False,
            candidate_id="legacy-" + binding.legacy_job_id,
            canonical_book=book_artifact,
            epub=epub,
            validation_report=report_artifact,
            resources=resources,
            finding_codes=["LEGACY_SCHEMA_REQUIRES_MIGRATION", "CANDIDATE_REQUIRES_VALIDATION"],
        )
    )
