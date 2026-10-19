"""Durable local-worker checkpoints and conservative, cumulative paid-call accounting.

Use a SQLite database on a local filesystem (not a network-mounted/shared-volume database).
Every mutation uses BEGIN IMMEDIATE. Artifacts are private immutable snapshots: consumers
must use ``read_checkpoint`` to verify their content before reuse. Lease times use the host
wall clock; workers sharing the database must share that clock.

No model has an implicit spending allowance. Configure each exact model ID explicitly,
including prior spending and conservative upper bounds for historical unknown charges.
A returned reservation permits dispatch ONLY when ``is_new`` is true. Repeated request
keys never authorize another provider call, including after a crash. Unknown calls retain
their full bound until explicit reconciliation; settlement records actual overruns rather
than concealing them and permanently blocks new reservations for that model pending
operator review. This ledger cannot enforce a provider's billing upper bound.
"""

from __future__ import annotations

import hashlib
import math
import os
import re
import sqlite3
import time
import uuid
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import cast

_MAX_MONEY = 9_000_000_000_000_000
_MAX_ARTIFACT_BYTES = 256 * 1024 * 1024
_DIGEST = re.compile(r"[0-9a-f]{64}")
_STAGE = re.compile(r"[A-Za-z][A-Za-z0-9_.-]{0,119}")


class StateError(RuntimeError):
    """The durable worker state does not permit the requested operation."""


class ConflictError(StateError):
    """An idempotency key or immutable value was reused with different input."""


class LeaseError(StateError):
    """A worker no longer holds the current unexpired lease."""


class BudgetError(StateError):
    """A paid call has no authorized allowance or would exceed it."""


class BudgetOverrunError(BudgetError):
    """Actual provider cost exceeded its reservation; the charge was recorded."""


@dataclass(frozen=True)
class Job:
    id: str
    owner_id: str
    request_key: str
    source_sha256: str
    config_sha256: str
    status: str
    cancellation_epoch: int
    lease_fence: int
    result_checkpoint_id: str | None


@dataclass(frozen=True)
class Lease:
    job_id: str
    owner_id: str
    worker_id: str
    fence: int
    cancellation_epoch: int
    expires_at: float


@dataclass(frozen=True)
class Checkpoint:
    id: str
    job_id: str
    stage: str
    attempt_key: str
    artifact_path: Path
    sha256: str
    size_bytes: int


@dataclass(frozen=True)
class Reservation:
    model: str
    request_key: str
    max_cost_microusd: int
    status: str
    actual_cost_microusd: int | None
    is_new: bool = False


@dataclass(frozen=True)
class BudgetSnapshot:
    model: str
    cap_microusd: int
    known_microusd: int
    reserved_microusd: int
    unknown_microusd: int
    blocked_reason: str | None = None

    @property
    def exposure_microusd(self) -> int:
        return self.known_microusd + self.reserved_microusd + self.unknown_microusd

    @property
    def remaining_microusd(self) -> int:
        return max(0, self.cap_microusd - self.exposure_microusd)


def _key(value: str, label: str) -> None:
    if not isinstance(value, str) or not value.strip() or len(value) > 1000 or "\x00" in value:
        raise ValueError(f"Invalid {label}")


def _money(value: int, label: str) -> None:
    if type(value) is not int or not 0 <= value <= _MAX_MONEY:
        raise ValueError(f"{label} must be an integer microUSD amount in [0, {_MAX_MONEY}]")


class _Database:
    def __init__(self, db_path: str | Path, *, clock: Callable[[], float] = time.time) -> None:
        if str(db_path) == ":memory:":
            raise ValueError("Use an on-disk database for durable state")
        self.path = Path(db_path).resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.clock = clock
        with self._connection() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, request_key TEXT NOT NULL,
                    source_sha256 TEXT NOT NULL, config_sha256 TEXT NOT NULL,
                    status TEXT NOT NULL, cancellation_epoch INTEGER NOT NULL DEFAULT 0,
                    lease_fence INTEGER NOT NULL DEFAULT 0, worker_id TEXT, lease_until REAL,
                    result_checkpoint_id TEXT,
                    UNIQUE(owner_id, request_key)
                );
                CREATE TABLE IF NOT EXISTS checkpoints (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL,
                    job_id TEXT NOT NULL REFERENCES jobs(id), stage TEXT NOT NULL,
                    attempt_key TEXT NOT NULL, artifact_path TEXT NOT NULL,
                    sha256 TEXT NOT NULL, size_bytes INTEGER NOT NULL,
                    UNIQUE(job_id, stage, attempt_key)
                );
                CREATE TABLE IF NOT EXISTS budgets (
                    model TEXT PRIMARY KEY, cap INTEGER NOT NULL,
                    historical_spent INTEGER NOT NULL, historical_unknown INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS budget_halts (
                    model TEXT PRIMARY KEY REFERENCES budgets(model), reason TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS reservations (
                    model TEXT NOT NULL REFERENCES budgets(model), request_key TEXT NOT NULL,
                    upper_bound INTEGER NOT NULL, status TEXT NOT NULL, actual INTEGER,
                    PRIMARY KEY(model, request_key)
                );
            """)

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=30, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA synchronous=FULL")
        try:
            yield connection
        finally:
            connection.close()

    @contextmanager
    def _transaction(self) -> Iterator[sqlite3.Connection]:
        with self._connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                yield connection
            except BaseException:
                connection.rollback()
                raise
            else:
                connection.commit()


def _job(row: sqlite3.Row) -> Job:
    return Job(**{name: row[name] for name in Job.__dataclass_fields__})


def _checkpoint(row: sqlite3.Row) -> Checkpoint:
    return Checkpoint(
        id=row["id"],
        job_id=row["job_id"],
        stage=row["stage"],
        attempt_key=row["attempt_key"],
        artifact_path=Path(row["artifact_path"]),
        sha256=row["sha256"],
        size_bytes=row["size_bytes"],
    )


class JobStore(_Database):
    """Isolated converter state; completing a job does not publish into AVA's library."""

    def create_job(
        self,
        owner_id: str,
        request_key: str,
        source_sha256: str,
        config_sha256: str,
    ) -> Job:
        _key(owner_id, "owner ID")
        _key(request_key, "request key")
        if not _DIGEST.fullmatch(source_sha256) or not _DIGEST.fullmatch(config_sha256):
            raise ValueError("Source and config fingerprints must be SHA-256 hex digests")
        with self._transaction() as connection:
            row = connection.execute(
                "SELECT * FROM jobs WHERE owner_id=? AND request_key=?",
                (owner_id, request_key),
            ).fetchone()
            if row:
                if row["source_sha256"] != source_sha256 or row["config_sha256"] != config_sha256:
                    raise ConflictError(
                        "Request key belongs to a different source or configuration"
                    )
                return _job(row)
            job_id = uuid.uuid4().hex
            connection.execute(
                "INSERT INTO jobs(id,owner_id,request_key,source_sha256,config_sha256,status) "
                "VALUES(?,?,?,?,?,'queued')",
                (job_id, owner_id, request_key, source_sha256, config_sha256),
            )
            return _job(self._get(connection, owner_id, job_id))

    @staticmethod
    def _get(connection: sqlite3.Connection, owner_id: str, job_id: str) -> sqlite3.Row:
        row = connection.execute(
            "SELECT * FROM jobs WHERE id=? AND owner_id=?",
            (job_id, owner_id),
        ).fetchone()
        if row is None:
            raise StateError("Job not found for this owner")
        return cast(sqlite3.Row, row)

    def get_job(self, owner_id: str, job_id: str) -> Job:
        with self._connection() as connection:
            return _job(self._get(connection, owner_id, job_id))

    @staticmethod
    def _ttl(ttl_seconds: float) -> None:
        if not math.isfinite(ttl_seconds) or not 0 < ttl_seconds <= 86400:
            raise ValueError("Lease duration must be finite, positive, and no more than one day")

    def _leased(self, connection: sqlite3.Connection, lease: Lease) -> sqlite3.Row:
        row = self._get(connection, lease.owner_id, lease.job_id)
        if (
            row["status"] != "running"
            or row["worker_id"] != lease.worker_id
            or row["lease_fence"] != lease.fence
            or row["cancellation_epoch"] != lease.cancellation_epoch
            or row["lease_until"] <= self.clock()
        ):
            raise LeaseError("Lease expired, was replaced, or job was cancelled/completed")
        return row

    def acquire(
        self,
        owner_id: str,
        job_id: str,
        worker_id: str,
        ttl_seconds: float = 60,
    ) -> Lease:
        _key(worker_id, "worker ID")
        self._ttl(ttl_seconds)
        with self._transaction() as connection:
            row = self._get(connection, owner_id, job_id)
            now = self.clock()
            if row["status"] not in {"queued", "running"}:
                raise LeaseError("Terminal job cannot acquire a new lease")
            if row["status"] == "running" and row["lease_until"] > now:
                raise LeaseError("Another unexpired lease already owns this job")
            fence = row["lease_fence"] + 1
            until = now + ttl_seconds
            connection.execute(
                "UPDATE jobs SET status='running',worker_id=?,lease_until=?,lease_fence=? "
                "WHERE id=?",
                (worker_id, until, fence, job_id),
            )
            return Lease(job_id, owner_id, worker_id, fence, row["cancellation_epoch"], until)

    def heartbeat(self, lease: Lease, ttl_seconds: float = 60) -> Lease:
        self._ttl(ttl_seconds)
        with self._transaction() as connection:
            self._leased(connection, lease)
            until = self.clock() + ttl_seconds
            connection.execute("UPDATE jobs SET lease_until=? WHERE id=?", (until, lease.job_id))
            return Lease(
                lease.job_id,
                lease.owner_id,
                lease.worker_id,
                lease.fence,
                lease.cancellation_epoch,
                until,
            )

    def checkpoint(
        self,
        lease: Lease,
        stage: str,
        artifact_path: str | Path,
        attempt_key: str | None = None,
    ) -> Checkpoint:
        if not _STAGE.fullmatch(stage):
            raise ValueError("Invalid checkpoint stage")
        attempt_key = attempt_key if attempt_key is not None else uuid.uuid4().hex
        _key(attempt_key, "attempt key")
        source = Path(artifact_path)
        # Read once: the caller can replace its mutable working file after this snapshot.
        with source.open("rb") as stream:
            data = stream.read(_MAX_ARTIFACT_BYTES + 1)
        if len(data) > _MAX_ARTIFACT_BYTES:
            raise ValueError("Checkpoint exceeds the 256 MiB artifact limit")
        digest = hashlib.sha256(data).hexdigest()
        destination: Path | None = None
        try:
            with self._transaction() as connection:
                self._leased(connection, lease)
                previous = connection.execute(
                    "SELECT * FROM checkpoints WHERE job_id=? AND stage=? AND attempt_key=?",
                    (lease.job_id, stage, attempt_key),
                ).fetchone()
                if previous:
                    if previous["sha256"] != digest:
                        raise ConflictError("Checkpoint attempt key already has different content")
                    result = _checkpoint(previous)
                    self._read_artifact(result)
                    return result
                checkpoint_id = uuid.uuid4().hex
                artifact_root = self.path.with_name(self.path.name + ".artifacts")
                artifact_root.mkdir(exist_ok=True, mode=0o700)
                directory = artifact_root / lease.job_id
                directory.mkdir(exist_ok=True, mode=0o700)
                destination = directory / checkpoint_id
                with destination.open("xb") as stream:
                    stream.write(data)
                    stream.flush()
                    os.fsync(stream.fileno())
                destination.chmod(0o400)
                # Persist newly created directory entries before the SQLite row can commit.
                for parent in (directory, artifact_root, self.path.parent):
                    directory_fd = os.open(parent, os.O_RDONLY)
                    try:
                        os.fsync(directory_fd)
                    finally:
                        os.close(directory_fd)
                self._leased(connection, lease)
                connection.execute(
                    "INSERT INTO checkpoints(id,job_id,stage,attempt_key,artifact_path,sha256,"
                    "size_bytes) VALUES(?,?,?,?,?,?,?)",
                    (
                        checkpoint_id,
                        lease.job_id,
                        stage,
                        attempt_key,
                        str(destination),
                        digest,
                        len(data),
                    ),
                )
                return Checkpoint(
                    checkpoint_id,
                    lease.job_id,
                    stage,
                    attempt_key,
                    destination,
                    digest,
                    len(data),
                )
        except BaseException:
            if destination is not None:
                destination.unlink(missing_ok=True)
            raise

    def latest_checkpoint(self, owner_id: str, job_id: str, stage: str) -> Checkpoint | None:
        with self._connection() as connection:
            self._get(connection, owner_id, job_id)
            row = connection.execute(
                "SELECT * FROM checkpoints WHERE job_id=? AND stage=? "
                "ORDER BY sequence DESC LIMIT 1",
                (job_id, stage),
            ).fetchone()
            if row is None:
                return None
            result = _checkpoint(row)
            self._read_artifact(result)
            return result

    @staticmethod
    def _read_artifact(checkpoint: Checkpoint) -> bytes:
        try:
            with checkpoint.artifact_path.open("rb") as stream:
                data = stream.read(_MAX_ARTIFACT_BYTES + 1)
        except OSError as error:
            raise StateError("Checkpoint artifact is missing or unreadable") from error
        if (
            len(data) != checkpoint.size_bytes
            or hashlib.sha256(data).hexdigest() != checkpoint.sha256
        ):
            raise StateError("Checkpoint artifact hash/length verification failed")
        return data

    def read_checkpoint(self, owner_id: str, checkpoint_id: str) -> bytes:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT checkpoints.* FROM checkpoints JOIN jobs ON jobs.id=checkpoints.job_id "
                "WHERE checkpoints.id=? AND jobs.owner_id=?",
                (checkpoint_id, owner_id),
            ).fetchone()
            if row is None:
                raise StateError("Checkpoint not found for this owner")
            return self._read_artifact(_checkpoint(row))

    def complete(self, lease: Lease, checkpoint: Checkpoint) -> Job:
        with self._transaction() as connection:
            current = self._get(connection, lease.owner_id, lease.job_id)
            # A lost completion response can be retried only by the same fenced attempt.
            if (
                current["status"] == "succeeded"
                and current["result_checkpoint_id"] == checkpoint.id
                and current["lease_fence"] == lease.fence
                and current["cancellation_epoch"] == lease.cancellation_epoch
                and current["worker_id"] == lease.worker_id
            ):
                row = connection.execute(
                    "SELECT * FROM checkpoints WHERE id=? AND job_id=?",
                    (checkpoint.id, lease.job_id),
                ).fetchone()
                if row is None:
                    raise StateError("Completion checkpoint is missing")
                self._read_artifact(_checkpoint(row))
                return _job(current)
            self._leased(connection, lease)
            row = connection.execute(
                "SELECT * FROM checkpoints WHERE id=? AND job_id=?",
                (checkpoint.id, lease.job_id),
            ).fetchone()
            if row is None:
                raise StateError("Completion checkpoint does not belong to this job")
            # Trust the persisted record, never a caller-modified dataclass's path or hash.
            self._read_artifact(_checkpoint(row))
            # Hash verification may take time: reject a lease which expired while reading.
            self._leased(connection, lease)
            connection.execute(
                "UPDATE jobs SET status='succeeded',result_checkpoint_id=?,lease_until=NULL "
                "WHERE id=?",
                (checkpoint.id, lease.job_id),
            )
            return _job(self._get(connection, lease.owner_id, lease.job_id))

    def cancel(self, owner_id: str, job_id: str) -> Job:
        with self._transaction() as connection:
            current = self._get(connection, owner_id, job_id)
            if current["status"] == "succeeded":
                raise StateError("Completed output cannot be retroactively cancelled")
            if current["status"] != "cancelled":
                connection.execute(
                    "UPDATE jobs SET status='cancelled',cancellation_epoch=cancellation_epoch+1,"
                    "lease_until=NULL,worker_id=NULL WHERE id=?",
                    (job_id,),
                )
            return _job(self._get(connection, owner_id, job_id))

    def release(self, lease: Lease) -> Job:
        with self._transaction() as connection:
            self._leased(connection, lease)
            connection.execute(
                "UPDATE jobs SET status='queued',lease_until=NULL,worker_id=NULL WHERE id=?",
                (lease.job_id,),
            )
            return _job(self._get(connection, lease.owner_id, lease.job_id))


class BudgetStore(_Database):
    """One persisted cap per exact model ID across all jobs using this database."""

    def configure(
        self,
        model: str,
        cap_microusd: int,
        historical_spent_microusd: int = 0,
        historical_unknown_microusd: int = 0,
    ) -> BudgetSnapshot:
        _key(model, "exact model ID")
        for name, value in (
            ("cap", cap_microusd),
            ("historical spent", historical_spent_microusd),
            ("historical unknown", historical_unknown_microusd),
        ):
            _money(value, name)
        with self._transaction() as connection:
            previous = connection.execute(
                "SELECT * FROM budgets WHERE model=?", (model,)
            ).fetchone()
            values = (cap_microusd, historical_spent_microusd, historical_unknown_microusd)
            if previous:
                if (
                    previous["cap"],
                    previous["historical_spent"],
                    previous["historical_unknown"],
                ) != values:
                    raise ConflictError("Persisted budget/history cannot be changed by configure")
            else:
                connection.execute("INSERT INTO budgets VALUES(?,?,?,?)", (model, *values))
            return self._snapshot(connection, model)

    @staticmethod
    def _snapshot(connection: sqlite3.Connection, model: str) -> BudgetSnapshot:
        budget = connection.execute("SELECT * FROM budgets WHERE model=?", (model,)).fetchone()
        if budget is None:
            raise BudgetError("No explicit budget configured for this exact model ID")
        known = budget["historical_spent"]
        reserved = 0
        unknown = budget["historical_unknown"]
        for row in connection.execute("SELECT * FROM reservations WHERE model=?", (model,)):
            if row["status"] == "settled":
                known += row["actual"]
            elif row["status"] == "unknown":
                unknown += row["upper_bound"]
            else:
                reserved += row["upper_bound"]
        halt = connection.execute(
            "SELECT reason FROM budget_halts WHERE model=?",
            (model,),
        ).fetchone()
        return BudgetSnapshot(
            model,
            budget["cap"],
            known,
            reserved,
            unknown,
            halt["reason"] if halt else None,
        )

    def snapshot(self, model: str) -> BudgetSnapshot:
        # Explicit read transaction gives a consistent snapshot across the two queries.
        with self._connection() as connection:
            connection.execute("BEGIN")
            return self._snapshot(connection, model)

    @staticmethod
    def _reservation(row: sqlite3.Row, *, is_new: bool = False) -> Reservation:
        return Reservation(
            row["model"],
            row["request_key"],
            row["upper_bound"],
            row["status"],
            row["actual"],
            is_new,
        )

    @staticmethod
    def _attempt(connection: sqlite3.Connection, model: str, request_key: str) -> sqlite3.Row:
        row = connection.execute(
            "SELECT * FROM reservations WHERE model=? AND request_key=?",
            (model, request_key),
        ).fetchone()
        if row is None:
            raise BudgetError("Reservation does not exist")
        return cast(sqlite3.Row, row)

    def reserve(self, model: str, request_key: str, max_cost_microusd: int) -> Reservation:
        _key(model, "exact model ID")
        _key(request_key, "provider request key")
        _money(max_cost_microusd, "maximum cost")
        if max_cost_microusd == 0:
            raise ValueError("Paid calls require a positive conservative cost bound")
        with self._transaction() as connection:
            existing = connection.execute(
                "SELECT * FROM reservations WHERE model=? AND request_key=?",
                (model, request_key),
            ).fetchone()
            if existing:
                if existing["upper_bound"] != max_cost_microusd:
                    raise ConflictError("Request key reused with a different cost bound")
                return self._reservation(existing)
            current = self._snapshot(connection, model)
            if current.blocked_reason:
                raise BudgetError(current.blocked_reason)
            if current.exposure_microusd + max_cost_microusd > current.cap_microusd:
                raise BudgetError("Cumulative model exposure would exceed its persisted cap")
            connection.execute(
                "INSERT INTO reservations VALUES(?,?,?,'reserved',NULL)",
                (model, request_key, max_cost_microusd),
            )
            return self._reservation(self._attempt(connection, model, request_key), is_new=True)

    def mark_unknown(self, model: str, request_key: str) -> Reservation:
        with self._transaction() as connection:
            current = self._attempt(connection, model, request_key)
            if current["status"] == "settled":
                raise ConflictError("A settled charge cannot become unknown")
            connection.execute(
                "UPDATE reservations SET status='unknown' WHERE model=? AND request_key=?",
                (model, request_key),
            )
            return self._reservation(self._attempt(connection, model, request_key))

    def settle(self, model: str, request_key: str, actual_cost_microusd: int) -> Reservation:
        """Settle a definitive response; unknown attempts require ``reconcile`` instead."""
        return self._settle(model, request_key, actual_cost_microusd, reconcile=False)

    def reconcile(self, model: str, request_key: str, actual_cost_microusd: int) -> Reservation:
        """Explicitly reconcile an uncertain attempt against authoritative provider billing."""
        return self._settle(model, request_key, actual_cost_microusd, reconcile=True)

    def _settle(
        self,
        model: str,
        request_key: str,
        actual_cost_microusd: int,
        *,
        reconcile: bool,
    ) -> Reservation:
        _money(actual_cost_microusd, "actual cost")
        overrun = False
        with self._transaction() as connection:
            row = self._attempt(connection, model, request_key)
            if row["status"] == "settled":
                if row["actual"] != actual_cost_microusd:
                    raise ConflictError("Settled cost cannot be changed")
                return self._reservation(row)
            if row["status"] == "unknown" and not reconcile:
                raise BudgetError("Unknown attempt requires explicit reconciliation")
            if reconcile and row["status"] != "unknown":
                raise BudgetError("Only an unknown attempt can be reconciled")
            connection.execute(
                "UPDATE reservations SET status='settled',actual=? WHERE model=? AND request_key=?",
                (actual_cost_microusd, model, request_key),
            )
            result = self._reservation(self._attempt(connection, model, request_key))
            overrun = actual_cost_microusd > row["upper_bound"]
            if overrun:
                connection.execute(
                    "INSERT OR IGNORE INTO budget_halts VALUES(?,?)",
                    (model, "Provider exceeded a reservation; new calls require budget review"),
                )
        if overrun:
            raise BudgetOverrunError("Provider exceeded its reserved bound; actual cost persisted")
        return result
