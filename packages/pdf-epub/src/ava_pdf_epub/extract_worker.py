"""Bounded subprocess entry; avoids keeping untrusted PDF parsing in the job coordinator."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .io import atomic_write, write_json


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["native", "benchmark", "inspect"])
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--run", type=Path)
    args = parser.parse_args()
    if sys.platform.startswith("linux"):
        import resource

        for kind, configured in [(resource.RLIMIT_AS, 3 * 1024**3), (resource.RLIMIT_CPU, 900)]:
            soft, hard = resource.getrlimit(kind)
            bounded = min(
                [configured] + [limit for limit in (soft, hard) if limit != resource.RLIM_INFINITY]
            )
            resource.setrlimit(kind, (bounded, bounded))
    if args.mode == "inspect":
        from .extract import inspect_pdf

        write_json(args.output, inspect_pdf(args.source))
        return
    if args.mode == "benchmark":
        from .benchmark import import_benchmark

        if args.run is None:
            parser.error("benchmark requires --run")
        book = import_benchmark(args.source, args.run, args.output.parent / "assets")
    else:
        from .extract import extract_native

        book = extract_native(args.source, args.output.parent / "assets")
    atomic_write(args.output, book.model_dump_json(indent=2).encode())


if __name__ == "__main__":
    main()
