"""Kill the whole extraction process group when the host's last confirmed lease expires."""

import json
import os
import signal
import subprocess
import sys
import time

from .lease_reader import read_lease


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
        while True:
            updated = read_lease(
                sequence, deadline, handshake_deadline, process is not None, time.monotonic()
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
                    stdin=subprocess.DEVNULL,
                    start_new_session=True,
                )
            code = process.poll()
            if code is not None:
                raise SystemExit(code if code >= 0 else 128 - code)
            time.sleep(0.1)
    except Exception:
        print(json.dumps({"version": "ava-runtime-error-1", "code": "LEASE_EXPIRED"}), flush=True)
        raise SystemExit(1) from None
    finally:
        if process is not None and process.poll() is None:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=2)


if __name__ == "__main__":
    main()
