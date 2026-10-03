"""Fixed isolated publication validator: exact EPUB conservation plus EPUBCheck."""

import hashlib
import json
import sys
from pathlib import Path

from ..checks import epubcheck
from ..contracts.common import MAX_WIRE_BYTES
from ..contracts.private_files import snapshot
from ..epub_v2.reader import prepare_reader
from ..epub_v2.reimport import reimport_epub
from .epub_verdict import InvalidEpub, epub_verdict


def main() -> None:
    try:
        root = Path("/scratch")
        (root / "tmp").mkdir(exist_ok=True)
        data = snapshot(Path("/input"), "source.pdf", 256 * 1024 * 1024)
        request = json.loads(snapshot(Path("/input"), "job.json", 65536))
        if set(request) != {"canonical_sha256", "epub_sha256", "final_content_id"}:
            raise ValueError("Invalid validator context")
        if hashlib.sha256(data).hexdigest() != request["epub_sha256"]:
            raise ValueError("EPUB identity mismatch")
        book = reimport_epub(data, request["canonical_sha256"])
        reader = prepare_reader(book, request["final_content_id"])
        epub = root / "candidate.epub"
        epub.write_bytes(data)
        check = epubcheck(epub, Path("/opt/epubcheck/epubcheck.jar"), timeout=120)
        manifest = json.loads(Path("/opt/epubcheck/ava-distribution.json").read_text())
        errors, warnings = epub_verdict(check)
        result = {
            "schema_version": "ava-epub-validation-1",
            "epub_sha256": request["epub_sha256"],
            "canonical_sha256": request["canonical_sha256"],
            "canonical_conservation": "pass",
            "reader_package": reader.model_dump(mode="json"),
            "epubcheck": {
                "status": "pass",
                "version": manifest["version"],
                "distribution_sha256": manifest["manifest_sha256"],
                "errors": errors,
                "warnings": warnings,
            },
        }
        output = json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode()
        if len(output) > MAX_WIRE_BYTES + 65536:
            raise ValueError("Validator output exceeds bound")
        sys.stdout.buffer.write(output)
    except (ValueError, InvalidEpub):
        failure("INVALID_EPUB")
    except Exception:
        failure("VALIDATOR_UNAVAILABLE")


def failure(code: str) -> None:
    print(json.dumps({"schema_version": "ava-epub-validation-error-1", "code": code}))
    raise SystemExit(1) from None


if __name__ == "__main__":
    main()
