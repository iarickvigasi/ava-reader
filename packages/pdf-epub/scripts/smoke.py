#!/usr/bin/env python3
"""Exercise the installed CLI with authored source and retain reviewable outputs."""

import argparse
from pathlib import Path

from smoke_checks import verify_candidate, verify_reuse, write_summary
from smoke_contract import write_envelope
from smoke_fixture import fixture
from smoke_runner import command_runner


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--epubcheck-jar", type=Path)
    args = parser.parse_args()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=False)
    source = out / "native-smoke.pdf"
    fixture(source)
    command = command_runner(out)
    inspection = command("inspect", ["inspect", str(source)], 0)
    assert inspection["page_count"] == 2
    invocation = [
        "convert",
        str(source),
        "--work-dir",
        str(out / "work"),
        "--owner",
        "synthetic-smoke",
        "--request-key",
        "initial-import",
    ]
    if args.epubcheck_jar:
        invocation += ["--epubcheck-jar", str(args.epubcheck_jar.resolve())]
    first = command("first", invocation, 2)
    verify_candidate(first, out, require_epubcheck=bool(args.epubcheck_jar))
    again = command("reused", invocation, 2)
    verify_reuse(first, again)
    status = command(
        "status",
        ["status", first["job_id"], "--work-dir", str(out / "work"), "--owner", "synthetic-smoke"],
        0,
    )
    assert status["status"] == "succeeded"
    write_envelope(out)
    write_summary(out, source, first)


if __name__ == "__main__":
    main()
