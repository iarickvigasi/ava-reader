"""Kill the whole extraction process group when the host's last confirmed lease expires."""

import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from ..contracts.private_files import snapshot
from .lease_reader import read_lease


def exchange_input(target: str) -> int | None:
    """Only the host-admitted finite entry inherits stdin; ordinary commands keep DEVNULL."""
    marker = os.environ.get("AVA_PDF_RUNTIME_EXCHANGE")
    if marker is None:
        return subprocess.DEVNULL
    if marker != "attempt_stream" or target != "ava_pdf_epub.reconstruction_v2":
        raise ValueError("Unapproved exchange entry")

    def unique(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate exchange key")
            result[key] = value
        return result

    packet = json.loads(
        snapshot(Path("/input"), "reconstruction-request.json", 67108864),
        object_pairs_hook=unique,
    )
    job = json.loads(snapshot(Path("/input"), "job.json", 65536), object_pairs_hook=unique)
    if not isinstance(packet, dict) or set(packet) != {"mode", "input"} or packet["mode"] != marker:
        raise ValueError("Unapproved exchange request")
    request = packet["input"]
    required = {
        "schema_version",
        "source_sha256",
        "profile_id",
        "responses",
        "refinements",
    }
    if (
        not isinstance(request, dict)
        or not required <= set(request)
        or set(request) - required - {"source_feature_policy"}
    ):
        raise ValueError("Unapproved exchange fields")
    if request["schema_version"] != "ava-reconstruct-input-1" or request["profile_id"] not in (
        "ava-pdf-prose-en-v2",
        "ava-pdf-prose-en-uk-v3",
    ):
        raise ValueError("Unapproved exchange profile")
    if (
        request["responses"] != []
        or request["refinements"] != []
        or (
            "source_feature_policy" in request
            and request["source_feature_policy"] != "ava-ocr-source-features-1"
        )
    ):
        raise ValueError("Unapproved exchange initial state")
    digest = request["source_sha256"]
    if (
        not isinstance(digest, str)
        or len(digest) != 64
        or any(c not in "0123456789abcdef" for c in digest)
    ):
        raise ValueError("Unapproved exchange digest")
    if (
        not isinstance(job, dict)
        or not isinstance(job.get("source"), dict)
        or job["source"].get("sha256") != digest
        or job.get("profile_id") != request["profile_id"]
    ):
        raise ValueError("Exchange job differs")
    return None


def main() -> None:
    target = os.environ.get("AVA_PDF_RUNTIME_TARGET", "ava_pdf_epub.runtime")
    if target not in {
        "ava_pdf_epub.runtime",
        "ava_pdf_epub.runtime.inspect",
        "ava_pdf_epub.runtime.validate_epub",
        "ava_pdf_epub.runtime.import_epub",
        "ava_pdf_epub.reconstruction_v2",
    }:
        raise SystemExit(1)
    process = None
    sequence, deadline = -1, 0.0
    handshake_deadline = time.monotonic() + 1
    first_sequence = None
    try:
        child_input = exchange_input(target)
        while True:
            updated = read_lease(
                sequence,
                deadline,
                handshake_deadline,
                process is not None,
                time.monotonic(),
            )
            if updated is None:
                time.sleep(0.025)
                continue
            sequence, deadline = updated
            if process is None:
                if first_sequence is None:
                    first_sequence = sequence
                if sequence == first_sequence:
                    if time.monotonic() >= handshake_deadline:
                        raise TimeoutError("No live lease writer")
                    time.sleep(0.1)
                    continue
                process = subprocess.Popen(
                    [sys.executable, "-I", "-m", target],
                    stdin=child_input,
                    start_new_session=True,
                )
            code = process.poll()
            if code is not None:
                raise SystemExit(code if code >= 0 else 128 - code)
            time.sleep(0.1)
    except Exception:
        print(
            json.dumps({"version": "ava-runtime-error-1", "code": "LEASE_EXPIRED"}),
            flush=True,
        )
        raise SystemExit(1) from None
    finally:
        if process is not None and process.poll() is None:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=2)


if __name__ == "__main__":
    main()
