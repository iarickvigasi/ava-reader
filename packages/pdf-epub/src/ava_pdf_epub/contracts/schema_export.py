"""Deterministic Draft2020-12 structural schemas; semantic validation is additional."""

import json
from pathlib import Path

from .registry import MODELS


def schemas() -> dict[str, dict[str, object]]:
    result = {}
    for version, model in MODELS.items():
        schema = model.model_json_schema()
        schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
        schema["$id"] = "urn:ava:contract:" + version
        schema["$comment"] = (
            "Generated from ava_pdf_epub.contracts. Graph, digest, normalization and authority "
            "semantics require the pinned Python validator; "
            "structural success never grants readiness."
        )
        result[version] = schema
    return result


def export_schemas(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for version, schema in schemas().items():
        (directory / (version + ".schema.json")).write_text(
            json.dumps(schema, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
            encoding="utf-8",
        )
