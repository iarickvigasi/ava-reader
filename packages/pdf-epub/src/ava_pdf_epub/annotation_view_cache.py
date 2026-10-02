"""Hash-bound private rendering cache; a pathname alone never proves compatible content."""

import hashlib
import json
from pathlib import Path
from uuid import uuid4

POLICY = "passive-annotation-routing-v5"


def cached_view(
    source: Path, scratch: Path, *, policy: str = POLICY
) -> tuple[Path | None, Path, Path]:
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    key = hashlib.sha256((policy + digest).encode()).hexdigest()
    output = scratch / f"annotation-view-{key}.pdf"
    receipt = output.with_suffix(".json")
    if not receipt.exists():
        return None, output, receipt
    if receipt.stat().st_size > 2048:
        raise ValueError("PDF_ANNOTATION_VIEW_CACHE_INVALID")
    try:
        stored = json.loads(receipt.read_text())
    except (ValueError, OSError) as error:
        raise ValueError("PDF_ANNOTATION_VIEW_CACHE_INVALID") from error
    if stored == {"policy": policy, "passthrough": True}:
        return source, output, receipt
    if (
        not isinstance(stored, dict)
        or set(stored) != {"policy", "sha256"}
        or stored["policy"] != policy
        or not output.is_file()
        or output.stat().st_size > 52428800
        or hashlib.sha256(output.read_bytes()).hexdigest() != stored["sha256"]
    ):
        raise ValueError("PDF_ANNOTATION_VIEW_CACHE_INVALID")
    return output, output, receipt


def remember_view(output: Path | None, receipt: Path, *, policy: str = POLICY) -> None:
    receipt.parent.mkdir(parents=True, exist_ok=True)
    record: dict[str, str | bool] = {"policy": policy}
    if output is None:
        record["passthrough"] = True
    else:
        if output.stat().st_size > 52428800:
            raise ValueError("PDF_RESOURCE_LIMIT")
        record["sha256"] = hashlib.sha256(output.read_bytes()).hexdigest()
    temporary = receipt.with_name(receipt.name + "." + uuid4().hex + ".partial")
    try:
        temporary.write_text(json.dumps(record, sort_keys=True))
        temporary.replace(receipt)
    finally:
        temporary.unlink(missing_ok=True)
