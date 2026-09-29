"""Generate valid synthetic reader UI fixtures with the worker's hash authority."""

import copy
import hashlib
import json
from pathlib import Path

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.capabilities import required_capabilities
from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.contracts.reader import ReaderPackageV3

root = Path(__file__).parents[1] / "features/reader/canonical/fixtures"
base = json.loads((root / "canonical.json").read_text())
cold = copy.deepcopy(base)
for index, label in [(2, "The middle shore"), (3, "The crossing")]:
    identity = f"extra-{index}"
    block_id = f"{identity}-heading"
    path = f"text/{identity}.xhtml"
    target = {"kind": "internal", "chapter_id": identity, "block_id": block_id, "offset": 0}
    cold["blocks"].append(
        {
            "id": block_id,
            "kind": "heading",
            "level": 1,
            "content": {
                "text": label,
                "sha256": hashlib.sha256(label.encode()).hexdigest(),
                "codepoint_utf16": list(range(len(label) + 1)),
                "spans": [],
            },
            "evidence": next(
                block
                for block in base["blocks"]
                if block["id"] == base["chapters"][0]["block_ids"][-1]
            )["evidence"],
        }
    )
    cold["chapters"].insert(
        index - 1,
        {
            "id": identity,
            "title": label,
            "role": "bodymatter",
            "resource_paths": [path],
            "block_ids": [block_id],
        },
    )
    cold["spine"].insert(index - 1, identity)
    cold["toc"].insert(
        index - 1, {"id": f"toc-{identity}", "label": label, "target": target}
    )
    cold["addresses"].append({"resource_path": path, "fragment": identity, "target": target})
    cold["addresses"].append({"resource_path": path, "fragment": block_id, "target": target})
by_id = {block["id"]: block for block in cold["blocks"]}
cold["blocks"] = [
    by_id[identity] for chapter in cold["chapters"] for identity in chapter["block_ids"]
]
for name, value in [("reader-package", base), ("cold-reader-package", cold)]:
    book = CanonicalBookV2.model_validate(value)
    package = ReaderPackageV3(
        schema_version="ava-reader-3",
        version=3,
        final_content_id=f"authored-{name}",
        canonical_hash_algorithm="ava-json-v1",
        canonical_sha256=document_digest(book),
        required_capabilities=sorted(required_capabilities(book)),
        book=book,
    )
    (root / f"{name}.json").write_text(package.model_dump_json(indent=2) + "\n")
    print(name, package.canonical_sha256)
