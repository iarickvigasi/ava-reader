"""Private subprocess protocol: no payload echo, paths, secrets or provider dispatch."""

import argparse
import json
import sys
from pathlib import Path

from .common import MAX_WIRE_BYTES
from .registry import validate_contract
from .schema_export import export_schemas
from .wire import decode_wire


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["validate", "export-schemas"])
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    if args.action == "export-schemas":
        export_schemas(args.out or Path(__file__).parent / "schemas")
        return 0
    try:
        request = decode_wire(sys.stdin.buffer.read(MAX_WIRE_BYTES + 1))
        if not isinstance(request, dict) or set(request) != {"schema_version", "payload"}:
            raise ValueError("Invalid validation request")
        if not isinstance(request["schema_version"], str):
            raise ValueError("Invalid schema tag")
        validate_contract(request["schema_version"], request["payload"])
    except (ValueError, TypeError, KeyError, RecursionError, OverflowError):
        print(json.dumps({"valid": False}))
        return 1
    print(json.dumps({"valid": True}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
