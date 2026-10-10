"""Identify installed Python/schema boundary bytes, separately from runtime isolation."""

import hashlib
import importlib.metadata
import json
from pathlib import Path


def installed_package_fingerprint() -> str:
    root = Path(__file__).parents[1]
    files = {
        str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.rglob("*"))
        if path.is_file() and path.suffix in {".py", ".json"}
    }
    dependencies = {
        name: importlib.metadata.version(name)
        for name in (
            "ava-pdf-epub",
            "pypdf",
            "pydantic",
            "pydantic_core",
            "Pillow",
            "pdfplumber",
            "pdfminer.six",
        )
    }
    data = json.dumps(
        {"files": files, "dependencies": dependencies}, sort_keys=True, separators=(",", ":")
    ).encode()
    return hashlib.sha256(data).hexdigest()
