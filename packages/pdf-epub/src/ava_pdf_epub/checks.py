"""Independent EPUBCheck and explicit readiness gates, never inferred from ZIP success."""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path
from typing import Any

from .io import read_json
from .models import Book


def epubcheck(epub: Path, jar: Path | None, timeout: int = 120) -> dict[str, Any]:
    if jar is None:
        return {"status": "not_run", "reason": "EPUBCheck jar was not configured"}
    if not jar.is_file():
        return {"status": "fail", "reason": "Configured EPUBCheck jar does not exist"}
    with tempfile.TemporaryDirectory(prefix="ava-epubcheck-") as work:
        report = Path(work) / "report.json"
        try:
            result = subprocess.run(
                [
                    "java",
                    "-Xmx512m",
                    f"-Djava.io.tmpdir={work}",
                    "-jar",
                    str(jar.resolve()),
                    str(epub.resolve()),
                    "--json",
                    str(report),
                ],
                capture_output=True,
                timeout=timeout,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {"status": "fail", "reason": type(exc).__name__}
        payload = read_json(report, 4 * 1024 * 1024) if report.exists() else {}
        return {
            "status": "pass" if result.returncode == 0 else "fail",
            "returncode": result.returncode,
            "report": payload,
            "diagnostic": result.stderr.decode("utf-8", errors="replace")[-2000:],
        }


def readiness(
    book: Book, assembly: dict[str, Any], package_check: dict[str, Any]
) -> dict[str, Any]:
    issues = assembly.get("issues", [])
    unresolved = [i for i in issues if i.get("severity") in {"review", "error"}]
    uncertain_chapters = [c.id for c in book.chapters if not c.verified]
    missing = [p.number for p in book.pages if p.route == "needs_ocr"]
    return {
        "structural_export": "pass" if assembly.get("export_valid") else "fail",
        "epubcheck": package_check["status"],
        "source_review": "required" if unresolved or uncertain_chapters or missing else "not_run",
        "unresolved_issues": len(unresolved),
        "unverified_chapters": uncertain_chapters,
        "recognition_required_pages": missing,
        "visual_review": "not_run",
        "accessibility_review": "not_run",
        "ava_reader": "not_run",
        "library_publication": "not_implemented",
        "production_ready": False,
    }
