#!/usr/bin/env python3
"""Record installed distribution versions and supplied license metadata without network calls."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    distributions = []
    seen = set()
    for dist in sorted(
        importlib.metadata.distributions(), key=lambda d: d.metadata["Name"].lower()
    ):
        identity = (dist.metadata["Name"].lower(), dist.version)
        if identity in seen:
            continue
        seen.add(identity)
        licenses = []
        for entry in dist.files or []:
            if not any(term in str(entry).lower() for term in ("license", "copying", "notice")):
                continue
            path = Path(dist.locate_file(entry))
            if path.is_file():
                licenses.append(
                    {
                        "path": str(entry),
                        "bytes": path.stat().st_size,
                        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                    }
                )
        distributions.append(
            {
                "name": dist.metadata["Name"],
                "version": dist.version,
                "license_expression": dist.metadata.get("License-Expression"),
                "license_metadata": (dist.metadata.get("License") or "")[:512],
                "license_classifiers": [
                    c for c in dist.metadata.get_all("Classifier", []) if c.startswith("License ::")
                ],
                "license_files": licenses,
            }
        )
    result = {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "packages": distributions,
        "scope": "Installed Python distributions, not a complete native SBOM or legal opinion.",
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2) + "\n")
    print(f"Recorded {len(distributions)} distributions in {args.out}")


if __name__ == "__main__":
    main()
