"""Resumable local worker. Completion means artifacts exist, never library publication."""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
import uuid
from contextlib import AbstractContextManager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from . import __version__
from .checks import epubcheck, readiness
from .io import atomic_write, canonical_json, digest_file, read_bytes, write_json
from .models import Book, Claim
from .review import Review, apply_review
from .state import JobStore, Lease, LeaseError

Mode = Literal["native", "benchmark", "book"]
MAX_SOURCE_BYTES = 200 * 1024 * 1024


def implementation_fingerprint() -> str:
    files = {p.name: digest_file(p) for p in sorted(Path(__file__).parent.glob("*.py"))}
    deps = {
        name: importlib.metadata.version(name)
        for name in ("pypdf", "pydantic", "Pillow", "pdfplumber", "pdfminer.six")
    }
    return hashlib.sha256(canonical_json({"files": files, "dependencies": deps})).hexdigest()


class Heartbeat(AbstractContextManager["Heartbeat"]):
    def __init__(self, store: JobStore, lease: Lease):
        self.store, self.lease = store, lease
        self.stop = threading.Event()
        self.error: Exception | None = None
        self.thread = threading.Thread(target=self._run, daemon=True)

    def _run(self) -> None:
        while not self.stop.wait(10):
            try:
                self.lease = self.store.heartbeat(self.lease, ttl_seconds=60)
            except Exception as exc:
                self.error = exc
                return

    def check(self) -> None:
        if self.error:
            raise self.error
        self.lease = self.store.heartbeat(self.lease, ttl_seconds=60)

    def __enter__(self) -> Heartbeat:
        self.thread.start()
        return self

    def __exit__(self, *args: Any) -> None:
        self.stop.set()
        self.thread.join(timeout=15)


def _extract(
    mode: Mode, source: Path, output: Path, run: Path | None, heartbeat: Heartbeat, timeout: int
) -> None:
    command = [sys.executable, "-m", "ava_pdf_epub.extract_worker", mode, str(source), str(output)]
    if run:
        command.extend(["--run", str(run.resolve())])
    started = time.monotonic()
    with (output.parent / "extraction.stderr.log").open("wb") as errors:
        process = subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=errors,
            start_new_session=True,
        )
        try:
            while process.poll() is None:
                if heartbeat.error:
                    raise heartbeat.error
                if time.monotonic() - started > timeout:
                    raise TimeoutError("Extraction exceeded its wall time limit")
                heartbeat.stop.wait(0.25)
            if process.returncode != 0:
                raise RuntimeError("Extraction failed; inspect the private extraction.stderr.log")
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()


def _bound_file(path: Path, limit: int = MAX_SOURCE_BYTES) -> str:
    if not path.is_file() or not 0 < path.stat().st_size <= limit:
        raise ValueError(f"Input must be a nonempty file of at most {limit} bytes")
    return digest_file(path)


def _configuration(
    mode: Mode,
    source: Path,
    run: Path | None,
    asset_root: Path | None,
    review: Path | None,
    jar: Path | None,
    timeout: int,
) -> dict[str, Any]:
    config: dict[str, Any] = {
        "version": __version__,
        "implementation": implementation_fingerprint(),
        "mode": mode,
        "timeout": timeout,
        "input_sha256": _bound_file(source),
        "review": _bound_file(review) if review else None,
        "epubcheck": _bound_file(jar) if jar else None,
    }
    if mode == "benchmark":
        if run is None:
            raise ValueError("Benchmark replay requires a run directory")
        pages = sorted((run / "pages").glob("*.json"))
        if not 0 < len(pages) <= 5000:
            raise ValueError("Invalid benchmark page inventory")
        config["replay"] = {
            str(p.relative_to(run)): _bound_file(p, 4 * 1024**2)
            for p in pages + [run / "book-plan-finalized.json", run / "config.json"]
        }
    if asset_root:
        config["asset_root"] = str(asset_root.resolve())
    return config


def run_conversion(
    *,
    source: Path,
    work_dir: Path,
    owner: str,
    request_key: str,
    mode: Mode = "native",
    run: Path | None = None,
    asset_root: Path | None = None,
    review: Path | None = None,
    epubcheck_jar: Path | None = None,
    timeout: int = 1200,
) -> dict[str, Any]:
    """Idempotent per owner/request; explicitly change request_key when revising inputs/config."""
    from .epub import build_epub

    if not 1 <= timeout <= 3600:
        raise ValueError("Extraction timeout must be 1..3600 seconds")
    source = source.resolve(strict=True)
    work_dir = work_dir.resolve()
    work_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    config = _configuration(mode, source, run, asset_root, review, epubcheck_jar, timeout)
    original_book = None
    if mode == "book":
        _bound_file(source, 64 * 1024**2)
        book_bytes = read_bytes(source)
        if hashlib.sha256(book_bytes).hexdigest() != config["input_sha256"]:
            raise ValueError("Book changed during snapshot")
        original_book = Book.model_validate_json(book_bytes)
    source_hash = original_book.source_sha256 if original_book else config["input_sha256"]
    config_hash = hashlib.sha256(canonical_json(config)).hexdigest()
    store = JobStore(work_dir / "state.sqlite3")
    job = store.create_job(owner, request_key, source_hash, config_hash)
    if job.status == "succeeded":
        if not job.result_checkpoint_id:
            raise RuntimeError("Completed job has no result checkpoint")
        report = json.loads(store.read_checkpoint(owner, job.result_checkpoint_id))
        store.read_checkpoint(owner, report["epub_checkpoint_id"])
        if digest_file(Path(report["epub_path"])) != report["epub_sha256"]:
            raise ValueError(
                "Exported EPUB changed after completion; immutable checkpoint is retained"
            )
        return dict(report, reused=True)
    lease = store.acquire(owner, job.id, uuid.uuid4().hex)
    failure = store.latest_checkpoint(owner, job.id, "failure")
    failure_count = (
        int(json.loads(store.read_checkpoint(owner, failure.id)).get("attempts", 1))
        if failure
        else 0
    )
    if failure_count >= 3:
        store.release(lease)
        raise RuntimeError(
            "Job exhausted three failed attempts; inspect failures before a new request"
        )
    attempt = work_dir / "jobs" / job.id / f"attempt-{lease.fence}"
    attempt.mkdir(parents=True, exist_ok=False, mode=0o700)
    started = time.monotonic()
    with Heartbeat(store, lease) as heartbeat:
        try:
            write_json(attempt / "configuration.json", config)
            previous = store.latest_checkpoint(owner, job.id, "book")
            if previous:
                book = Book.model_validate_json(store.read_checkpoint(owner, previous.id))
                context = store.latest_checkpoint(owner, job.id, "asset-context")
                if not context:
                    raise RuntimeError("Book checkpoint is missing its asset context")
                effective_assets = Path(
                    json.loads(store.read_checkpoint(owner, context.id))["root"]
                )
            else:
                if original_book is not None:
                    book = original_book
                else:
                    snapshot = attempt / "source.pdf"
                    shutil.copyfile(source, snapshot)
                    if digest_file(snapshot) != source_hash:
                        raise ValueError("Source changed during snapshot")
                    replay = None
                    if mode == "benchmark" and run is not None:
                        replay = attempt / "replay"
                        for relative, expected in config["replay"].items():
                            original = run / relative
                            data = read_bytes(original, 4 * 1024**2)
                            if hashlib.sha256(data).hexdigest() != expected:
                                raise ValueError("Benchmark input changed during snapshot")
                            atomic_write(replay / relative, data)
                    _extract(mode, snapshot, attempt / "extracted.json", replay, heartbeat, timeout)
                    extracted = attempt / "extracted.json"
                    _bound_file(extracted, 64 * 1024**2)
                    book = Book.model_validate_json(read_bytes(extracted))
                    if book.source_sha256 != source_hash:
                        raise ValueError("Extractor returned a different source identity")
                if review:
                    bounded = read_bytes(review)
                    if hashlib.sha256(bounded).hexdigest() != config["review"]:
                        raise ValueError("Review changed during execution")
                    book = apply_review(book, Review.model_validate_json(bounded))
                if not any(
                    c.field == "modified" and c.scope == "conversion" for c in book.metadata
                ):
                    book.metadata.append(
                        Claim(
                            field="modified",
                            value=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
                            status="accepted",
                            scope="conversion",
                        )
                    )
                # Attempt-private roots prevent a stale worker overwriting a replacement's assets.
                effective_assets = asset_root.resolve() if asset_root else attempt / "assets"
                write_json(attempt / "asset-context.json", {"root": str(effective_assets)})
                store.checkpoint(heartbeat.lease, "asset-context", attempt / "asset-context.json")
                atomic_write(attempt / "book.json", book.model_dump_json(indent=2).encode())
                store.checkpoint(heartbeat.lease, "book", attempt / "book.json")
            heartbeat.check()
            export = build_epub(book, effective_assets, attempt / "book.epub")
            if epubcheck_jar and digest_file(epubcheck_jar) != config["epubcheck"]:
                raise ValueError("EPUBCheck executable changed during execution")
            check = epubcheck(attempt / "book.epub", epubcheck_jar)
            heartbeat.check()
            epub_snapshot = store.checkpoint(heartbeat.lease, "epub", attempt / "book.epub")
            report = {
                "schema_version": "ava-conversion-result-1",
                "job_id": job.id,
                "source_sha256": source_hash,
                "config_sha256": config_hash,
                "book_revision_sha256": hashlib.sha256(book.model_dump_json().encode()).hexdigest(),
                "epub_checkpoint_id": epub_snapshot.id,
                "epub_sha256": epub_snapshot.sha256,
                "epub_path": str(attempt / "book.epub"),
                "assembly": export,
                "checks": {"epubcheck": check},
                "readiness": readiness(book, export, check),
                "wall_seconds": round(time.monotonic() - started, 3),
                "new_api_cost_usd": 0,
                "reused": False,
            }
            write_json(attempt / "result.json", report)
            final = store.checkpoint(heartbeat.lease, "result", attempt / "result.json")
            store.complete(heartbeat.lease, final)
            return report
        except BaseException as exc:
            try:
                write_json(
                    attempt / "failure.json",
                    {
                        "type": type(exc).__name__,
                        "message": str(exc)[:2000],
                        "attempts": failure_count + 1,
                    },
                )
                store.checkpoint(heartbeat.lease, "failure", attempt / "failure.json")
                store.release(heartbeat.lease)
            except LeaseError:
                pass
            raise
