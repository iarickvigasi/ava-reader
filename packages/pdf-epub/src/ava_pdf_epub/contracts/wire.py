"""Reject ambiguous duplicate-key JSON and bound bytes before decoding/parsing."""

import json
from typing import Any

from .common import MAX_WIRE_BYTES


def pairs_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON object key")
        result[key] = value
    return result


def reject_constant(value: str) -> None:
    raise ValueError("Non-finite JSON number")


def decode_wire(data: bytes) -> object:
    if not data or len(data) > MAX_WIRE_BYTES:
        raise ValueError("Invalid contract byte length")
    return json.loads(
        data.decode("utf-8"), object_pairs_hook=pairs_object, parse_constant=reject_constant
    )
