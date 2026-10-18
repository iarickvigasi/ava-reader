"""Kill the whole extraction process group when the host's last confirmed lease expires."""

import json
import os
import signal
import struct
import subprocess
import sys
import time
from pathlib import Path

from ..contracts.private_files import snapshot
from .lease_reader import read_lease
from .supervisor_exchange_configs import (
    _CELL_GEOMETRY_CONFIGS,
    _CONTINUATION_CONFIGS,
    _GEOMETRY_CONFIGS,
    _LAYOUT_CONFIGS,
    _NATIVE2_CONFIGS,
    _STRUCTURE_CONFIGS,
    _TITLE_CONFIGS,
    _WORD_WRAP_CONFIGS,
)


def _unique(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate exchange key")
        result[key] = value
    return result


def exchange_input(target: str) -> int | None:
    """Only the host-admitted finite entry inherits stdin; ordinary commands keep DEVNULL."""
    marker = os.environ.get("AVA_PDF_RUNTIME_EXCHANGE")
    if marker is None:
        return subprocess.DEVNULL
    if marker != "attempt_stream" or target != "ava_pdf_epub.reconstruction_v2":
        raise ValueError("Unapproved exchange entry")

    packet = json.loads(
        snapshot(Path("/input"), "reconstruction-request.json", 67108864),
        object_pairs_hook=_unique,
    )
    job = json.loads(snapshot(Path("/input"), "job.json", 65536), object_pairs_hook=_unique)
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
    layout = (
        isinstance(request, dict) and request.get("schema_version") == "ava-reconstruct-input-3"
    )
    native = (
        isinstance(request, dict) and request.get("schema_version") == "ava-reconstruct-input-4"
    )
    word_wrap = isinstance(request, dict) and request.get("schema_version") in (
        "ava-reconstruct-input-5",
        "ava-reconstruct-input-6",
        "ava-reconstruct-input-7",
        "ava-reconstruct-input-8",
        "ava-reconstruct-input-9",
        "ava-reconstruct-input-10",
    )
    continuation = (
        isinstance(request, dict) and request.get("schema_version") == "ava-reconstruct-input-10"
    )
    cell = continuation or (
        isinstance(request, dict) and request.get("schema_version") == "ava-reconstruct-input-9"
    )
    native2 = cell or (
        isinstance(request, dict) and request.get("schema_version") == "ava-reconstruct-input-8"
    )
    title = isinstance(request, dict) and request.get("schema_version") in (
        "ava-reconstruct-input-7",
        "ava-reconstruct-input-8",
        "ava-reconstruct-input-9",
        "ava-reconstruct-input-10",
    )
    geometry = isinstance(request, dict) and request.get("schema_version") in (
        "ava-reconstruct-input-6",
        "ava-reconstruct-input-7",
        "ava-reconstruct-input-8",
        "ava-reconstruct-input-9",
        "ava-reconstruct-input-10",
    )
    if (
        not isinstance(request, dict)
        or not required <= set(request)
        or set(request)
        - required
        - (
            {
                "source_feature_policy",
                "source_layout_policy",
                "source_structure_policy",
                "native_structure_responses",
            }
            | ({"source_normalization_policy", "word_wrap_responses"} if word_wrap else set())
            | ({"recognition_repair_policy", "geometry_corrections"} if geometry else set())
            | ({"source_title_policy"} if title else set())
            | ({"source_continuation_policy"} if continuation else set())
            if native or word_wrap
            else {"source_feature_policy", "source_layout_policy"}
            if layout
            else {"source_feature_policy"}
        )
    ):
        raise ValueError("Unapproved exchange fields")
    if request["schema_version"] not in (
        "ava-reconstruct-input-1",
        "ava-reconstruct-input-3",
        "ava-reconstruct-input-4",
        "ava-reconstruct-input-5",
        "ava-reconstruct-input-6",
        "ava-reconstruct-input-7",
        "ava-reconstruct-input-8",
        "ava-reconstruct-input-9",
        "ava-reconstruct-input-10",
    ) or request["profile_id"] not in (
        "ava-pdf-prose-en-v2",
        "ava-pdf-prose-en-uk-v3",
    ):
        raise ValueError("Unapproved exchange profile")
    if (
        request["responses"] != []
        or request["refinements"] != []
        or ((native or word_wrap) and request.get("native_structure_responses") != [])
        or (word_wrap and request.get("word_wrap_responses") != [])
        or (geometry and request.get("geometry_corrections") != [])
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
    config = job.get("config_sha256")
    if layout or native or word_wrap:
        if (
            request.get("source_layout_policy") != "ava-native-layout-1"
            or request.get("source_feature_policy") != "ava-ocr-source-features-1"
            or config
            != (
                _CONTINUATION_CONFIGS
                if continuation
                else _CELL_GEOMETRY_CONFIGS
                if cell
                else _NATIVE2_CONFIGS
                if native2
                else _TITLE_CONFIGS
                if title
                else _GEOMETRY_CONFIGS
                if geometry
                else _WORD_WRAP_CONFIGS
                if word_wrap
                else _STRUCTURE_CONFIGS
                if native
                else _LAYOUT_CONFIGS
            )[request["profile_id"]]
        ):
            raise ValueError("Exchange layout differs from captured configuration")
        if (native or word_wrap) and request.get("source_structure_policy") != (
            "ava-native-structure-2" if native2 else "ava-native-structure-1"
        ):
            raise ValueError("Exchange native structure differs from captured configuration")
        if word_wrap and request.get("source_normalization_policy") != "ava-native-word-wrap-1":
            raise ValueError("Exchange word-wrap differs from captured configuration")
        if geometry and request.get("recognition_repair_policy") != (
            "ava-recognition-geometry-repair-2" if cell else "ava-recognition-geometry-repair-1"
        ):
            raise ValueError("Exchange geometry repair differs from captured configuration")
        if title and request.get("source_title_policy") != "ava-frontmatter-title-1":
            raise ValueError("Exchange title differs from captured configuration")
        if (
            continuation
            and request.get("source_continuation_policy")
            != "ava-source-continuation-presentation-1"
        ):
            raise ValueError("Exchange continuation differs from captured configuration")
    elif config in (
        *_LAYOUT_CONFIGS.values(),
        *_STRUCTURE_CONFIGS.values(),
        *_WORD_WRAP_CONFIGS.values(),
        *_GEOMETRY_CONFIGS.values(),
        *_TITLE_CONFIGS.values(),
        *_NATIVE2_CONFIGS.values(),
        *_CELL_GEOMETRY_CONFIGS.values(),
        *_CONTINUATION_CONFIGS.values(),
    ):
        raise ValueError("Captured layout cannot use legacy exchange input")
    return None


def _entry_refusal(target: str) -> None:
    """A rejected pre-child entry is not a lease failure or a worker's source finding."""
    if (
        target != "ava_pdf_epub.reconstruction_v2"
        or os.environ.get("AVA_PDF_RUNTIME_EXCHANGE") != "attempt_stream"
    ):
        return
    try:
        job = json.loads(snapshot(Path("/input"), "job.json", 65536), object_pairs_hook=_unique)
        if not isinstance(job, dict) or not isinstance(job.get("source"), dict):
            return
        digest, profile = job["source"].get("sha256"), job.get("profile_id")
        if (
            not isinstance(digest, str)
            or len(digest) != 64
            or any(c not in "0123456789abcdef" for c in digest)
            or profile not in _LAYOUT_CONFIGS
        ):
            return
        data = json.dumps(
            {
                "schema_version": "ava-reconstruction-exchange-1",
                "sequence": 1,
                "source_sha256": digest,
                "profile_id": profile,
                "kind": "refusal",
                "payload": {
                    "schema_version": "ava-reconstruction-error-1",
                    "code": "RECONSTRUCTION_REVIEW_REQUIRED",
                },
            },
            separators=(",", ":"),
        ).encode()
        if len(data) > 1024:
            return
        sys.stdout.buffer.write(struct.pack(">I", len(data)) + data)
        sys.stdout.buffer.flush()
    except Exception:
        # No arbitrary parser/resource text and no invented source/job binding.
        return


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
    except Exception:
        _entry_refusal(target)
        print("AVA_PDF_EXCHANGE_ENTRY_REFUSED", file=sys.stderr, flush=True)
        raise SystemExit(1) from None
    try:
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
