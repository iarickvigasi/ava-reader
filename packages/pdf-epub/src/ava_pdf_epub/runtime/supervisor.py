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

# Exact server-captured opt-in configurations. Historical configurations remain untouched.
# These identities are also verified against the compiled API admission selector in tests.
_LAYOUT_CONFIGS = {
    "ava-pdf-prose-en-v2": "937942d4a700d14ac59de24559044e098726fe355173f93680dd4fe0a9929060",
    "ava-pdf-prose-en-uk-v3": "da2d14755d575a3b0fe0c8a0430dfe093996e144e62bf31c2cc04df450a4e315",
}
_STRUCTURE_CONFIGS = {
    "ava-pdf-prose-en-v2": "34b6f1e448f7311d3cd8f6c27b404f6d9e3904b461225895b4151d588c5749d7",
    "ava-pdf-prose-en-uk-v3": "0b3ad573e34a52e32bd2ebbe67fbb6f573676a262ef31f1c41c9c19929872fb8",
}
_WORD_WRAP_CONFIGS = {
    "ava-pdf-prose-en-v2": "7d59c08092c43b3a2cb7d3203ff2f6bf7ff5c580e82bf570251baaace05d746a",
    "ava-pdf-prose-en-uk-v3": "0c4c76cb8558a0574cf72d9adc2c11a60a3f661947be76e4d483dd5162252e2c",
}
_GEOMETRY_CONFIGS = {
    "ava-pdf-prose-en-v2": "75709f32827723b3675d81bc84177b6d7dfffbb3f9abb8ada5f48e504f84db4a",
    "ava-pdf-prose-en-uk-v3": "a12919c9d07e696b224aafc0e4f5d648d0e66406306b443f58628609595073e4",
}

_TITLE_CONFIGS = {
    "ava-pdf-prose-en-v2": "d8bb90385b949c5bf22eefafdb427ff3a76a25ba3e8ce006f1e28c3c7f348e5b",
    "ava-pdf-prose-en-uk-v3": "5fed6a113e4851d26b843716cf48bbddf954e64155c82fd0655e63607600b8d4",
}


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
    )
    title = isinstance(request, dict) and request.get("schema_version") == "ava-reconstruct-input-7"
    geometry = isinstance(request, dict) and request.get("schema_version") in (
        "ava-reconstruct-input-6",
        "ava-reconstruct-input-7",
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
                _TITLE_CONFIGS
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
        if (native or word_wrap) and request.get(
            "source_structure_policy"
        ) != "ava-native-structure-1":
            raise ValueError("Exchange native structure differs from captured configuration")
        if word_wrap and request.get("source_normalization_policy") != "ava-native-word-wrap-1":
            raise ValueError("Exchange word-wrap differs from captured configuration")
        if (
            geometry
            and request.get("recognition_repair_policy") != "ava-recognition-geometry-repair-1"
        ):
            raise ValueError("Exchange geometry repair differs from captured configuration")
        if title and request.get("source_title_policy") != "ava-frontmatter-title-1":
            raise ValueError("Exchange title differs from captured configuration")
    elif config in (
        *_LAYOUT_CONFIGS.values(),
        *_STRUCTURE_CONFIGS.values(),
        *_WORD_WRAP_CONFIGS.values(),
        *_GEOMETRY_CONFIGS.values(),
        *_TITLE_CONFIGS.values(),
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
