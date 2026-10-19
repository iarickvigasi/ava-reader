"""Explicit acknowledged development faults; no reader-controlled hook or live provider."""

import json
import os
import sys
import time
from pathlib import Path

from ..contracts.job import JobInputV1

FAULTS = {"deadline", "memory", "scratch", "output", "cpu"}


def trigger_fault(job: JobInputV1, root: Path) -> None:
    fault = os.environ.get("AVA_PDF_RUNTIME_FAULT")
    if fault is None:
        return
    if (
        os.environ.get("AVA_PDF_RUNTIME_MODE") != "development"
        or os.environ.get("AVA_PDF_FAULT_ACK") != "AVA_PDF_RUNTIME_FAULTS_V1"
        or fault not in FAULTS
    ):
        raise ValueError("FAULT_NOT_AUTHORIZED")
    print(
        json.dumps(
            {
                "event": "fault_ack",
                "fault": fault,
                "operation_id": job.operation_id,
                "attempt_fence": job.attempt_fence,
                "at_ms": int(time.time() * 1000),
            }
        ),
        file=sys.stderr,
        flush=True,
    )
    if fault == "deadline":
        time.sleep(3600)
    elif fault == "memory":
        chunks = []
        while True:
            chunks.append(bytearray(32 * 1024 * 1024))
    elif fault == "scratch":
        with (root / "quota-probe").open("wb") as stream:
            while True:
                stream.write(b"x" * 1024 * 1024)
                stream.flush()
    elif fault == "output":
        while True:
            sys.stdout.buffer.write(b"x" * 1024 * 1024)
            sys.stdout.buffer.flush()
    elif fault == "cpu":
        while True:
            pass
