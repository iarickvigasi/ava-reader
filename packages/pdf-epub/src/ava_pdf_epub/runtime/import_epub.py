"""Fixed isolated generated EPUB preparation; imported IDs never authorize server content."""

import hashlib
import json
import sys
from pathlib import Path

from ..artifact_stream import artifact_records
from ..checks import epubcheck
from ..contracts.common import document_digest
from ..contracts.private_files import snapshot
from ..epub_v2.portable import portable_epub
from ..epub_v2.reader import prepare_reader
from .epub_verdict import InvalidEpub, epub_verdict


def main() -> None:
    try:
        data = snapshot(Path("/input"), "source.pdf", 50 * 1024 * 1024)
        request = json.loads(snapshot(Path("/input"), "job.json", 65536))
        if set(request) != {"source_sha256", "final_content_id"}:
            raise ValueError("Invalid import request")
        if hashlib.sha256(data).hexdigest() != request["source_sha256"]:
            raise ValueError("Imported EPUB bytes changed")
        root = Path("/scratch")
        (root / "tmp").mkdir(exist_ok=True)
        epub = root / "import.epub"
        epub.write_bytes(data)
        errors, warnings = epub_verdict(
            epubcheck(epub, Path("/opt/epubcheck/epubcheck.jar"), timeout=120)
        )
        # EPUBCheck must not share its heap with the expanded canonical/reader models.
        book, assets = portable_epub(data)
        reader = prepare_reader(book, request["final_content_id"])
        report = {
            "schema_version": "ava-epub-import-1",
            "source_sha256": request["source_sha256"],
            "final_content_id": request["final_content_id"],
            "canonical_sha256": document_digest(book),
            "required_capabilities": reader.required_capabilities,
            "epubcheck": {"version": "5.4.0", "errors": errors, "warnings": warnings},
        }
        artifacts = {
            "canonical.json": book.model_dump_json().encode(),
            "reader.json": reader.model_dump_json().encode(),
            "import-report.json": json.dumps(report, separators=(",", ":")).encode(),
        }
        artifacts.update({f"resources/{r.sha256}": assets[r.id] for r in book.resources})
        for chunk in artifact_records(artifacts, report, "ava-epub-import-stream-1"):
            sys.stdout.buffer.write(chunk)
    except (ValueError, InvalidEpub):
        fail("INVALID_EPUB")
    except Exception:
        fail("VALIDATOR_UNAVAILABLE")


def fail(code: str) -> None:
    print(json.dumps({"schema_version": "ava-epub-import-error-1", "code": code}))
    raise SystemExit(1) from None


if __name__ == "__main__":
    main()
