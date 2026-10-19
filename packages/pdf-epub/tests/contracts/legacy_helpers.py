"""Authored integrity fixture; real installed-CLI proof is separately run by smoke.py."""

import hashlib
import json

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.contracts.job import JobInputV1
from ava_pdf_epub.contracts.legacy_result import LegacyInvocation
from ava_pdf_epub.contracts.private_files import describe
from ava_pdf_epub.io import canonical_json
from ava_pdf_epub.models import Block, Book, Chapter, Evidence, Page

from .helpers import fixture


def legacy_fixture(root):
    source = root / "source.pdf"
    source.write_bytes(b"%PDF-integrity-only-unit-fixture")
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    legacy_id = "a" * 32
    attempt = root / "work" / "jobs" / legacy_id / "attempt-1"
    attempt.mkdir(parents=True)
    config = dict(mode="native", input_sha256=source_hash, review=None)
    config_hash = hashlib.sha256(canonical_json(config)).hexdigest()
    (attempt / "configuration.json").write_bytes(canonical_json(config))
    book = Book(
        source_sha256=source_hash,
        page_count=1,
        pages=[
            Page(
                number=1,
                width=400.0,
                height=600.0,
                route="native",
                blocks=[
                    Block(
                        id="paragraph-one",
                        kind="paragraph",
                        text="Authored original text.",
                        evidence=[Evidence(page=1, method="native")],
                    )
                ],
            )
        ],
        chapters=[Chapter(id="chapter-one", title="One", start_block_id="paragraph-one")],
    )
    (attempt / "book.json").write_text(book.model_dump_json(indent=2))
    epub = attempt / "book.epub"
    epub.write_bytes(b"candidate-integrity-only-unit-fixture")
    report = dict(
        schema_version="ava-conversion-result-1",
        job_id=legacy_id,
        source_sha256=source_hash,
        config_sha256=config_hash,
        book_revision_sha256=hashlib.sha256(book.model_dump_json().encode()).hexdigest(),
        epub_sha256=hashlib.sha256(epub.read_bytes()).hexdigest(),
        epub_path=str(epub),
        assembly={"export_valid": True},
        checks={"epubcheck": {"status": "not_run"}},
        new_api_cost_usd=0,
        reused=False,
    )
    result_bytes = json.dumps(report).encode()
    (attempt / "result.json").write_bytes(result_bytes)
    (root / "stdout.json").write_bytes(result_bytes)
    raw_job = fixture("ava-pdf-job-1")
    raw_job["source"] = describe(root, "source.pdf", "SOURCE_PDF", "source-pdf").model_dump()
    job = JobInputV1.model_validate(raw_job)
    binding = LegacyInvocation(
        job_sha256=document_digest(job),
        legacy_job_id=legacy_id,
        legacy_config_sha256=config_hash,
        attempt_path=str(attempt.relative_to(root)),
        result_path="stdout.json",
    )
    return job, binding, report
