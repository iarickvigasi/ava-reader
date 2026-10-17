"""Fixed container paths. Invoke only behind the quota-enforcing Docker launcher."""

import errno
import json
import os
import sys
from pathlib import Path

from ..contracts.artifact_bytes import verify_artifact_bytes
from ..contracts.job import JobInputV1
from ..contracts.private_files import snapshot
from .bundle import encode_bundle
from .faults import trigger_fault
from .native import native_candidate
from .preflight import preflight


def main() -> None:
    try:
        root = Path("/scratch")
        os.umask(0o077)
        job = JobInputV1.model_validate_json(snapshot(Path("/input"), "job.json", 65536))
        if job.provider_mode != "native" or job.source.path != "source.pdf":
            raise ValueError("DISPATCH_NOT_AUTHORIZED")
        verify_artifact_bytes(Path("/input"), job.source)
        (root / "tmp").mkdir()
        trigger_fault(job, root)
        (root / "source.pdf").write_bytes(snapshot(Path("/input"), "source.pdf", 52428800))
        preflight(root / "source.pdf", job.source_page_limit)
        result = native_candidate(job, root)
        sys.stdout.buffer.write(encode_bundle(result, root))
        sys.stdout.buffer.flush()
        raise SystemExit(result.outcome.cli_exit_code)
    except Exception as error:
        resource = (
            isinstance(error, MemoryError)
            or str(error) == "RESULT_SIZE_LIMIT"
            or (
                isinstance(error, OSError)
                and error.errno in {errno.ENOSPC, errno.EFBIG, errno.ENOMEM}
            )
        )
        code = "RESOURCE_LIMIT" if resource else "WORKER_FAILED"
        print(json.dumps({"version": "ava-runtime-error-1", "code": code}), flush=True)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
