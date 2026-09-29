"""All commands are local. Exit 2 means a generated EPUB still needs content/reader review."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from dataclasses import asdict
from pathlib import Path
from typing import Any

from .io import read_json
from .models import Book
from .pipeline import run_conversion
from .review import Review
from .state import JobStore


def _print(value: Any) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2, default=str))


def main() -> None:
    parser = argparse.ArgumentParser(prog="ava-pdf-epub")
    commands = parser.add_subparsers(dest="command", required=True)
    inspect = commands.add_parser("inspect", help="Read bounded PDF structural inventory")
    inspect.add_argument("source", type=Path)
    schema = commands.add_parser("schema", help="Emit versioned Book or Review JSON Schema")
    schema.add_argument("kind", choices=["book", "review"], default="book", nargs="?")
    for name, mode in (("convert", "native"), ("from-benchmark", "benchmark"), ("build", "book")):
        task = commands.add_parser(name)
        task.set_defaults(mode=mode)
        task.add_argument("source", type=Path)
        task.add_argument("--work-dir", type=Path, required=True)
        task.add_argument("--owner", required=True)
        task.add_argument("--request-key", required=True)
        task.add_argument("--assets", type=Path)
        task.add_argument("--review", type=Path)
        task.add_argument("--epubcheck-jar", type=Path)
        task.add_argument("--timeout", type=int, default=1200)
        if name == "from-benchmark":
            task.add_argument("--run", type=Path, required=True)
    for name in ("status", "cancel"):
        task = commands.add_parser(name)
        task.add_argument("job_id")
        task.add_argument("--work-dir", type=Path, required=True)
        task.add_argument("--owner", required=True)
    args = parser.parse_args()
    try:
        if args.command == "schema":
            _print((Book if args.kind == "book" else Review).model_json_schema())
        elif args.command == "inspect":
            with tempfile.TemporaryDirectory(prefix="ava-inspect-") as temporary:
                destination = Path(temporary) / "inspection.json"
                inspection_process = subprocess.run(
                    [
                        sys.executable,
                        "-m",
                        "ava_pdf_epub.extract_worker",
                        "inspect",
                        str(args.source.resolve()),
                        str(destination),
                    ],
                    timeout=120,
                    capture_output=True,
                    check=False,
                )
                if inspection_process.returncode:
                    raise ValueError("PDF inspection rejected the source or could not complete")
                _print(read_json(destination))
        elif args.command in {"status", "cancel"}:
            store = JobStore(args.work_dir / "state.sqlite3")
            operation = store.cancel if args.command == "cancel" else store.get_job
            _print(asdict(operation(args.owner, args.job_id)))
        else:
            result = run_conversion(
                source=args.source,
                mode=args.mode,
                work_dir=args.work_dir,
                owner=args.owner,
                request_key=args.request_key,
                asset_root=args.assets,
                review=args.review,
                run=getattr(args, "run", None),
                epubcheck_jar=args.epubcheck_jar,
                timeout=args.timeout,
            )
            _print(result)
            if (
                not result["assembly"]["export_valid"]
                or result["checks"]["epubcheck"]["status"] == "fail"
            ):
                raise SystemExit(1)
            raise SystemExit(2)  # Reviewable artifact; does not claim production/library readiness.
    except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired) as exc:
        _print({"status": "failed", "error_type": type(exc).__name__, "message": str(exc)[:2000]})
        sys.exit(1)


if __name__ == "__main__":
    main()
