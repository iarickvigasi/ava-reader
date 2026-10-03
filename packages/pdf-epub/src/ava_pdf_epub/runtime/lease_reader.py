"""A transient shared-filesystem rename gap cannot grant or extend execution authority."""

from pathlib import Path

from ..contracts.private_files import snapshot
from .lease_control import advance_lease


def read_lease(
    sequence: int, deadline: float, startup_deadline: float, started: bool, now: float
) -> tuple[int, float] | None:
    try:
        raw = snapshot(Path("/input"), "lease.json", 1024)
    except FileNotFoundError:
        limit = deadline if sequence >= 0 else startup_deadline
        if not started:
            limit = min(limit, startup_deadline)
        if now >= limit:
            raise ValueError("Lease control unavailable") from None
        return None
    return advance_lease(raw, sequence, deadline, now)
