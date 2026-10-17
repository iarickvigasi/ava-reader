"""Real on-disk SQLite races and restart/fencing tests; no provider calls."""

from __future__ import annotations

import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from ava_pdf_epub.state import (
    BudgetError,
    BudgetOverrunError,
    BudgetStore,
    ConflictError,
    JobStore,
    LeaseError,
    StateError,
)

SOURCE = "a" * 64
CONFIG = "b" * 64


class StateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.db = self.root / "worker.sqlite3"
        self.now = 100.0
        self.store = JobStore(self.db, clock=lambda: self.now)
        self.artifact = self.root / "input.json"
        self.artifact.write_text('{"valid":true}')
        self.job = self.store.create_job("owner", "request", SOURCE, CONFIG)

    def test_idempotency_is_owner_and_input_bound(self) -> None:
        self.assertEqual(
            self.job,
            self.store.create_job("owner", "request", SOURCE, CONFIG),
        )
        with self.assertRaises(ConflictError):
            self.store.create_job("owner", "request", "c" * 64, CONFIG)
        with self.assertRaises(ConflictError):
            self.store.create_job("owner", "request", SOURCE, "d" * 64)
        other = self.store.create_job("another-owner", "request", SOURCE, CONFIG)
        self.assertNotEqual(self.job.id, other.id)
        with self.assertRaises(StateError):
            self.store.get_job("another-owner", self.job.id)

    def test_real_connections_allow_one_lease(self) -> None:
        # Initialize both handles before entering the barrier. Calls open separate connections.
        stores = [JobStore(self.db, clock=lambda: self.now) for _ in range(2)]
        barrier = threading.Barrier(2)

        def claim(index: int) -> str:
            barrier.wait()
            try:
                stores[index].acquire("owner", self.job.id, f"worker-{index}")
                return "acquired"
            except LeaseError:
                return "blocked"

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(claim, range(2)))
        self.assertCountEqual(outcomes, ["acquired", "blocked"])

    def test_crashed_lease_reclaimed_and_old_worker_fenced(self) -> None:
        first = self.store.acquire("owner", self.job.id, "worker", ttl_seconds=5)
        self.now = 105.0
        restarted = JobStore(self.db, clock=lambda: self.now)
        next_lease = restarted.acquire("owner", self.job.id, "worker", ttl_seconds=5)
        self.assertGreater(next_lease.fence, first.fence)
        with self.assertRaises(LeaseError):
            self.store.checkpoint(first, "extract", self.artifact)
        with self.assertRaises(LeaseError):
            self.store.heartbeat(first)
        cp = restarted.checkpoint(next_lease, "extract", self.artifact)
        self.assertEqual(restarted.complete(next_lease, cp).status, "succeeded")

    def test_cancel_blocks_late_checkpoint_and_complete(self) -> None:
        lease = self.store.acquire("owner", self.job.id, "worker")
        checkpoint = self.store.checkpoint(lease, "export", self.artifact)
        cancelled = self.store.cancel("owner", self.job.id)
        self.assertEqual(cancelled.cancellation_epoch, 1)
        self.assertEqual(self.store.cancel("owner", self.job.id), cancelled)
        with self.assertRaises(LeaseError):
            self.store.complete(lease, checkpoint)
        with self.assertRaises(LeaseError):
            self.store.checkpoint(lease, "another", self.artifact)
        with self.assertRaises(LeaseError):
            self.store.acquire("owner", self.job.id, "worker2")
        self.assertIsNone(self.store.get_job("owner", self.job.id).result_checkpoint_id)

    def test_cancel_complete_race_has_one_terminal_outcome(self) -> None:
        lease = self.store.acquire("owner", self.job.id, "worker")
        cp = self.store.checkpoint(lease, "export", self.artifact)
        other = JobStore(self.db, clock=lambda: self.now)
        barrier = threading.Barrier(2)

        def complete() -> str:
            barrier.wait()
            try:
                return self.store.complete(lease, cp).status
            except StateError:
                return "blocked"

        def cancel() -> str:
            barrier.wait()
            try:
                return other.cancel("owner", self.job.id).status
            except StateError:
                return "blocked"

        with ThreadPoolExecutor(max_workers=2) as pool:
            result_a = pool.submit(complete)
            result_b = pool.submit(cancel)
            outcomes = [result_a.result(), result_b.result()]
        self.assertEqual(outcomes.count("blocked"), 1)
        final = self.store.get_job("owner", self.job.id)
        self.assertIn(final.status, {"cancelled", "succeeded"})
        self.assertEqual(final.result_checkpoint_id is not None, final.status == "succeeded")

    def test_checkpoint_snapshot_survives_input_changes_and_restart(self) -> None:
        lease = self.store.acquire("owner", self.job.id, "worker")
        original = self.artifact.read_bytes()
        cp = self.store.checkpoint(lease, "extract", self.artifact, attempt_key="one")
        self.assertNotEqual(cp.artifact_path, self.artifact)
        self.artifact.write_text("changed")
        restarted = JobStore(self.db, clock=lambda: self.now)
        self.assertEqual(restarted.read_checkpoint("owner", cp.id), original)
        self.assertEqual(restarted.latest_checkpoint("owner", self.job.id, "extract"), cp)
        with self.assertRaises(ConflictError):
            restarted.checkpoint(lease, "extract", self.artifact, attempt_key="one")
        cp2 = restarted.checkpoint(lease, "extract", self.artifact, attempt_key="two")
        self.assertNotEqual(cp.id, cp2.id)
        self.assertEqual(restarted.latest_checkpoint("owner", self.job.id, "extract"), cp2)
        with self.assertRaises(StateError):
            restarted.read_checkpoint("another-owner", cp.id)

    def test_completion_hash_verifies_and_is_idempotent(self) -> None:
        lease = self.store.acquire("owner", self.job.id, "worker")
        cp = self.store.checkpoint(lease, "export", self.artifact)
        first = self.store.complete(lease, cp)
        self.assertEqual(first, self.store.complete(lease, cp))
        self.assertEqual(first.result_checkpoint_id, cp.id)
        with self.assertRaises(StateError):
            self.store.cancel("owner", self.job.id)

    def test_tampered_artifact_cannot_complete_or_resume(self) -> None:
        lease = self.store.acquire("owner", self.job.id, "worker")
        cp = self.store.checkpoint(lease, "export", self.artifact)
        cp.artifact_path.chmod(0o600)
        cp.artifact_path.write_text("corrupted")
        with self.assertRaises(StateError):
            self.store.complete(lease, cp)
        with self.assertRaises(StateError):
            self.store.latest_checkpoint("owner", self.job.id, "export")
        self.assertEqual(self.store.get_job("owner", self.job.id).status, "running")

    def test_lease_expiring_during_snapshot_does_not_commit(self) -> None:
        ticks = iter([100.0, 100.0, 161.0])
        timed = JobStore(self.db, clock=lambda: next(ticks))
        lease = timed.acquire("owner", self.job.id, "worker")
        with self.assertRaises(LeaseError):
            timed.checkpoint(lease, "export", self.artifact)
        self.assertIsNone(self.store.latest_checkpoint("owner", self.job.id, "export"))
        copies = list(self.db.with_name(self.db.name + ".artifacts").glob("*/*"))
        self.assertEqual(copies, [])

    def test_completion_retry_does_not_hide_missing_output(self) -> None:
        lease = self.store.acquire("owner", self.job.id, "worker")
        cp = self.store.checkpoint(lease, "export", self.artifact)
        self.store.complete(lease, cp)
        cp.artifact_path.unlink()
        with self.assertRaises(StateError):
            self.store.complete(lease, cp)

    def test_other_job_checkpoint_cannot_be_promoted(self) -> None:
        second = self.store.create_job("owner", "second", SOURCE, CONFIG)
        first_lease = self.store.acquire("owner", self.job.id, "one")
        second_lease = self.store.acquire("owner", second.id, "two")
        cp = self.store.checkpoint(first_lease, "export", self.artifact)
        with self.assertRaises(StateError):
            self.store.complete(second_lease, cp)

    def test_expiry_and_heartbeat_and_release(self) -> None:
        lease = self.store.acquire("owner", self.job.id, "worker", ttl_seconds=5)
        self.now = 104.0
        extended = self.store.heartbeat(lease, ttl_seconds=10)
        self.assertEqual(extended.expires_at, 114.0)
        self.now = 106.0
        self.assertEqual(self.store.release(extended).status, "queued")
        replacement = self.store.acquire("owner", self.job.id, "other")
        self.assertGreater(replacement.fence, lease.fence)
        with self.assertRaises(LeaseError):
            self.store.release(lease)
        self.now = replacement.expires_at
        with self.assertRaises(LeaseError):
            self.store.heartbeat(replacement)

    def test_invalid_duration_and_memory_database_rejected(self) -> None:
        for ttl in (0, -1, float("nan"), float("inf"), 86401):
            with self.assertRaises(ValueError):
                self.store.acquire("owner", self.job.id, "worker", ttl_seconds=ttl)
        with self.assertRaises(ValueError):
            JobStore(":memory:")


class BudgetTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = Path(self.temp.name) / "ledger.sqlite3"
        self.store = BudgetStore(self.db)
        self.model = "provider/exact-model-version"

    def test_no_implicit_paid_authorization(self) -> None:
        with self.assertRaises(BudgetError):
            self.store.reserve(self.model, "call", 1)
        self.store.configure(self.model, 0)
        with self.assertRaises(BudgetError):
            self.store.reserve(self.model, "call", 1)

    def test_atomic_cumulative_cap_across_real_connections(self) -> None:
        self.store.configure(self.model, 10_000_000, historical_spent_microusd=9_700_000)
        stores = [BudgetStore(self.db) for _ in range(2)]
        barrier = threading.Barrier(2)

        def reserve(index: int) -> str:
            barrier.wait()
            try:
                stores[index].reserve(self.model, f"call-{index}", 200_000)
                return "reserved"
            except BudgetError:
                return "blocked"

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(reserve, range(2)))
        self.assertCountEqual(outcomes, ["reserved", "blocked"])
        self.assertEqual(self.store.snapshot(self.model).exposure_microusd, 9_900_000)

    def test_restart_retains_reservation_without_redispatch(self) -> None:
        self.store.configure(self.model, 10_000_000)
        original = self.store.reserve(self.model, "request", 9_000_000)
        self.assertTrue(original.is_new)
        restarted = BudgetStore(self.db)
        replay = restarted.reserve(self.model, "request", 9_000_000)
        self.assertFalse(replay.is_new)
        self.assertEqual(restarted.snapshot(self.model).reserved_microusd, 9_000_000)
        with self.assertRaises(ConflictError):
            restarted.reserve(self.model, "request", 8_000_000)
        with self.assertRaises(BudgetError):
            restarted.reserve(self.model, "other", 1_000_001)

    def test_unknown_requires_explicit_reconciliation(self) -> None:
        self.store.configure(self.model, 10)
        self.store.reserve(self.model, "request", 10)
        unknown = self.store.mark_unknown(self.model, "request")
        self.assertEqual(unknown.status, "unknown")
        snapshot = self.store.snapshot(self.model)
        self.assertEqual((snapshot.reserved_microusd, snapshot.unknown_microusd), (0, 10))
        with self.assertRaises(BudgetError):
            self.store.reserve(self.model, "other", 1)
        with self.assertRaises(BudgetError):
            self.store.settle(self.model, "request", 4)
        self.assertFalse(self.store.reserve(self.model, "request", 10).is_new)
        self.store.reconcile(self.model, "request", 4)
        self.assertEqual(self.store.snapshot(self.model).remaining_microusd, 6)
        self.assertTrue(self.store.reserve(self.model, "other", 6).is_new)

    def test_settlement_idempotent_and_cannot_be_rewritten(self) -> None:
        self.store.configure(self.model, 100)
        self.store.reserve(self.model, "request", 50)
        first = self.store.settle(self.model, "request", 25)
        self.assertEqual(first, self.store.settle(self.model, "request", 25))
        self.assertEqual(first, self.store.reconcile(self.model, "request", 25))
        self.assertEqual(self.store.snapshot(self.model).known_microusd, 25)
        with self.assertRaises(ConflictError):
            self.store.settle(self.model, "request", 24)
        with self.assertRaises(ConflictError):
            self.store.mark_unknown(self.model, "request")

    def test_provider_overrun_persists_actual_charge_and_blocks_more_work(self) -> None:
        self.store.configure(self.model, 100)
        self.store.reserve(self.model, "request", 100)
        with self.assertRaises(BudgetOverrunError):
            self.store.settle(self.model, "request", 101)
        snapshot = BudgetStore(self.db).snapshot(self.model)
        self.assertEqual(snapshot.known_microusd, 101)
        self.assertEqual(snapshot.remaining_microusd, 0)
        with self.assertRaises(BudgetError):
            self.store.reserve(self.model, "another", 1)
        self.assertEqual(self.store.settle(self.model, "request", 101).status, "settled")

    def test_broken_provider_upper_bound_halts_model_even_below_cap(self) -> None:
        self.store.configure(self.model, 100)
        self.store.reserve(self.model, "request", 10)
        with self.assertRaises(BudgetOverrunError):
            self.store.settle(self.model, "request", 11)
        restarted = BudgetStore(self.db)
        self.assertEqual(restarted.snapshot(self.model).remaining_microusd, 89)
        self.assertIsNotNone(restarted.snapshot(self.model).blocked_reason)
        with self.assertRaises(BudgetError):
            restarted.reserve(self.model, "another", 1)

    def test_cap_and_historical_totals_cannot_change_silently(self) -> None:
        self.store.configure(self.model, 10, 4, 2)
        self.store.configure(self.model, 10, 4, 2)
        for cap, spent, unknown in ((11, 4, 2), (10, 3, 2), (10, 4, 0)):
            with self.assertRaises(ConflictError):
                self.store.configure(self.model, cap, spent, unknown)
        snapshot = self.store.snapshot(self.model)
        self.assertEqual((snapshot.known_microusd, snapshot.unknown_microusd), (4, 2))
        self.assertEqual(snapshot.remaining_microusd, 4)
        self.store.configure("already-over-budget", 10, 16)
        with self.assertRaises(BudgetError):
            self.store.reserve("already-over-budget", "new", 1)

    def test_integer_money_boundary_and_exact_model_identity(self) -> None:
        self.store.configure(self.model, 10_000_000, 9_999_999)
        self.assertTrue(self.store.reserve(self.model, "one-microdollar", 1).is_new)
        with self.assertRaises(BudgetError):
            self.store.reserve(self.model, "too-much", 1)
        with self.assertRaises(BudgetError):
            self.store.reserve(self.model + "-alias", "one", 1)
        for value in (-1, 1.5, True, 9_000_000_000_000_001):
            with self.assertRaises(ValueError):
                self.store.configure("invalid", value)  # type: ignore[arg-type]

    def test_simultaneous_same_request_authorizes_dispatch_once(self) -> None:
        self.store.configure(self.model, 100)
        stores = [BudgetStore(self.db) for _ in range(2)]
        barrier = threading.Barrier(2)

        def reserve(index: int) -> bool:
            barrier.wait()
            return stores[index].reserve(self.model, "identical", 60).is_new

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(reserve, range(2)))
        self.assertCountEqual(results, [True, False])
        self.assertEqual(self.store.snapshot(self.model).reserved_microusd, 60)


if __name__ == "__main__":
    unittest.main()
