"""One optional observation per fixed reconstruction command; no authority or output changes."""

import hashlib
import sys
import time
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar, Token
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal, cast

from .contracts.job import JobInputV1
from .contracts.private_files import snapshot
from .worker_observation_inventory import Inventory
from .worker_observation_packet import COMMANDS, TrustedUnit, binding, encode, failure
from .worker_observation_resources import resources, usage

ACTIVE: ContextVar["Observation | None"] = ContextVar("worker_observation", default=None)
Phase = Literal["prepare_source", "prepare_refinement", "reconstruct", "export"]


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class Observation:
    def __init__(self, scratch: Path) -> None:
        self.scratch, self.started, self.started_at = scratch, time.monotonic(), utc_now()
        self.before = usage()
        self.job: JobInputV1 | None = None
        self.token: Token[Observation | None] | None = None
        self.valid = True
        self.fields: dict[str, object] = {}
        self.inventory = Inventory()
        self.phases: list[dict[str, object]] = []
        self.reuse = {
            name: dict(hits=0, misses=0) for name in ("checkpoint_decode", "annotation_view")
        }
        self.outcome = "completed"
        self.failure_code: str | None = None
        self.findings: list[dict[str, object]] = []
        self.findings_complete = True

    def start(self, raw_request: bytes, request: Any, input_root: Path = Path("/input")) -> None:
        try:
            job = JobInputV1.model_validate_json(snapshot(input_root, "job.json", 65536))
            unit = TrustedUnit.model_validate_json(
                snapshot(input_root, "worker-observation.json", 1024)
            )
            command = request.get("mode") if isinstance(request, dict) else None
            if type(command) is not str or command not in COMMANDS:
                return
            number = request.get("page_number")
            self.fields = dict(
                binding=binding(job, unit, raw_request),
                command=command,
                page_number=number if type(number) is int and 1 <= number <= 500 else None,
            )
            self.job, self.token = job, ACTIVE.set(self)
        except Exception:
            self.valid = False  # Missing/incompatible trusted context cannot emit a bound claim.

    def record(self, event: str, *values: Any) -> None:
        try:
            if self.job is None:
                return
            if event == "source_bytes":
                data = values[0]
                if (
                    len(data) != self.job.source.byte_length
                    or hashlib.sha256(data).hexdigest() != self.job.source.sha256
                ):
                    raise ValueError("Observed source bytes differ")
                self.inventory.source_bytes_verified = True
            elif event == "source":
                digest, count, number, profile = values
                if digest != self.job.source.sha256 or profile != self.job.profile_id:
                    raise ValueError("Observed source identity differs")
                self.inventory.source(count, number, profile)
            elif event == "page":
                page = values[0]
                if (
                    page.source_sha256 != self.job.source.sha256
                    or page.profile_id != self.job.profile_id
                ):
                    raise ValueError("Observed page identity differs")
                self.inventory.page(page)
            elif event == "annotation":
                self.inventory.annotation(*values)
            elif event == "layout":
                self.inventory.layout(*values)
            elif event == "reuse":
                name, hit = values
                self.reuse[name]["hits" if hit else "misses"] += 1
        except Exception:
            self.valid = False

    def failed(self, error: BaseException) -> None:
        self.outcome = "failed"
        try:
            if self.job is not None:
                self.failure_code, self.findings, self.findings_complete = failure(
                    error, self.job.source.sha256
                )
        except Exception:
            self.valid = False

    def milliseconds(self) -> int:
        return round((time.monotonic() - self.started) * 1000)

    def finish(self) -> None:
        try:
            ended_ms, ended_at = self.milliseconds(), utc_now()
            if sys.exc_info()[1] is not None and self.outcome == "completed":
                self.outcome = "aborted"
            if self.job is None or not self.valid:
                return
            packet = dict(
                schema_version="ava-worker-observation-1",
                **self.fields,
                request_binding_scope="reconstruction_request_json_bytes",
                outcome=self.outcome,
                failure_code=self.failure_code,
                started_at=self.started_at,
                ended_at=ended_at,
                work_ms=ended_ms,
                method="PYTHON_MONOTONIC",
                phase_timing="inclusive_nested_not_summable",
                work_scope="main_command_excludes_interpreter_startup_and_observation_export",
                phases=sorted(self.phases, key=lambda item: cast(int, item["started_ms"])),
                resources=resources(self.before, self.scratch),
                inventory=self.inventory.packet(),
                reuse=dict(
                    source_preparation="none",
                    scope="worker_process_local_decode_and_annotation_memo",
                    **self.reuse,
                ),
                findings=self.findings,
                findings_complete=self.findings_complete,
            )
            data = encode(packet)
            if data is not None:
                sys.stderr.write(data.decode("ascii"))
                sys.stderr.flush()
        except Exception:
            pass  # Observation collection never changes the conversion's return/exception.
        finally:
            if self.token is not None:
                try:
                    ACTIVE.reset(self.token)
                except Exception:
                    pass
                self.token = None


def observe(event: str, *values: Any) -> None:
    current = ACTIVE.get()
    if current is not None:
        current.record(event, *values)


@contextmanager
def phase(name: Phase) -> Iterator[None]:
    current = ACTIVE.get()
    start = 0
    try:
        start = current.milliseconds() if current else 0
    except Exception:
        if current is not None:
            current.valid = False
        current = None
    outcome = "completed"
    try:
        yield
    except BaseException:
        outcome = "failed"
        raise
    finally:
        if current is not None:
            try:
                end = current.milliseconds()
                if len(current.phases) >= 8:
                    current.valid = False
                else:
                    current.phases.append(
                        dict(
                            name=name,
                            started_ms=start,
                            ended_ms=end,
                            work_ms=end - start,
                            outcome=outcome,
                        )
                    )
            except Exception:
                current.valid = False
