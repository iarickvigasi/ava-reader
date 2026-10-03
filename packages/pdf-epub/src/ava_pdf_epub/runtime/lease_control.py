"""A late renewal never resurrects expired local execution authority."""

import json


def advance_lease(raw: bytes, sequence: int, deadline: float, now: float) -> tuple[int, float]:
    if sequence >= 0 and now >= deadline:
        raise ValueError("Lease expired")
    lease = json.loads(raw)
    if (
        not isinstance(lease, dict)
        or set(lease) != {"sequence", "remaining_ms"}
        or type(lease["sequence"]) is not int
        or lease["sequence"] < max(0, sequence)
        or type(lease["remaining_ms"]) is not int
        or not 250 < lease["remaining_ms"] <= 30000
    ):
        raise ValueError("Invalid lease control")
    if lease["sequence"] > sequence:
        return lease["sequence"], now + (lease["remaining_ms"] - 250) / 1000
    return sequence, deadline
