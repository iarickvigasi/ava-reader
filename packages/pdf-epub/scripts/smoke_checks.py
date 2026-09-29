"""Verify candidate preservation and write a reviewable smoke summary."""

import hashlib
import importlib.metadata
import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from smoke_fixture import EXPECTED

import ava_pdf_epub


def verify_candidate(first: dict, out: Path, require_epubcheck: bool) -> None:
    epub = Path(first["epub_path"])
    assert epub.is_relative_to(out) and epub.is_file()
    assert hashlib.sha256(epub.read_bytes()).hexdigest() == first["epub_sha256"]
    retained = json.loads((epub.parent / "result.json").read_text())
    assert retained == first and first["assembly"]["export_valid"]
    assert first["new_api_cost_usd"] == 0 and not first["readiness"]["production_ready"]
    if require_epubcheck:
        assert first["checks"]["epubcheck"]["status"] == "pass"
    with zipfile.ZipFile(epub) as archive:
        bodies = [
            ET.fromstring(archive.read(name)).find("{http://www.w3.org/1999/xhtml}body")
            for name in archive.namelist()
            if name.endswith(".xhtml")
        ]
        all_text = " ".join(" ".join(body.itertext()) for body in bodies if body is not None)
        assert all(text in all_text for text in EXPECTED)
        assert any(name.endswith(".png") for name in archive.namelist())


def verify_reuse(first: dict, again: dict) -> None:
    assert again["reused"] and again["job_id"] == first["job_id"]
    assert again["epub_sha256"] == first["epub_sha256"]
    assert again["new_api_cost_usd"] == 0


def write_summary(out: Path, source: Path, first: dict) -> None:
    summary = {
        "status": "PASS",
        "package_version": importlib.metadata.version("ava-pdf-epub"),
        "module_path": str(ava_pdf_epub.__file__),
        "python": sys.version,
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "epub_sha256": first["epub_sha256"],
        "epub_path": first["epub_path"],
        "first_exit": 2,
        "repeated_exit": 2,
        "retained_result": True,
        "contract_job": str(out / "contract-job.json"),
        "contract_result": str(out / "contract-result.json"),
        "expected_text": EXPECTED,
        "native_image_retained": True,
        "reused": True,
        "new_api_cost_usd": 0,
        "epubcheck": first["checks"]["epubcheck"]["status"],
        "production_ready": False,
        "limits": "Standalone native candidate only; no AVA publication or OCR claim.",
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))
