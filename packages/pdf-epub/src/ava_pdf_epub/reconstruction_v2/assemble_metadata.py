"""Preserve source metadata with provenance; do not promote unprinted conflicts to facts."""

import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader

from .assembly_state import AssemblyState
from .metadata_scope import metadata_scope
from .printed_metadata import printed_metadata


def assemble_metadata(source: Path, state: AssemblyState, document_id: str) -> list[dict[str, Any]]:
    info = PdfReader(source).metadata
    claims: list[dict[str, Any]] = [
        dict(
            id="metadata-conversion-id",
            field="identifier",
            value="urn:ava:" + document_id,
            status="accepted",
            scope="conversion",
            origin="generated",
            identifier_scheme="uri",
        )
    ]
    printed = printed_metadata(state, getattr(info, "author", None))
    _, eligible = metadata_scope(state)
    mapping = [
        ("title", getattr(info, "title", None)),
        ("contributor", getattr(info, "author", None)),
        ("subject", getattr(info, "subject", None)),
    ]
    for field, value in mapping:
        if not value or not isinstance(value, str) or not value.strip():
            continue
        visible = next(
            (
                b
                for b in state.blocks
                if b["id"] in eligible
                and value.strip() == b.get("content", {}).get("text", "").strip()
            ),
            None,
        )
        evidence = visible["evidence"] if visible else state.blocks[0]["evidence"]
        claim = dict(
            id=f"metadata-{field}",
            field=field,
            value=value[:4000],
            status="accepted" if field == "contributor" and visible else "candidate",
            scope="work",
            origin="source",
            evidence=evidence,
        )
        if field == "contributor":
            claim["contributor_role"] = "author"
        claims.append(claim)
    subject = str(getattr(info, "subject", "") or "")
    match = re.search(r"ISBN[^0-9]{0,40}([0-9][0-9Xx -]{8,20}[0-9Xx])", subject)
    if match:
        value = re.sub(r"[^0-9Xx]", "", match[1])
        if len(value) in {10, 13}:
            claims.append(
                dict(
                    id="metadata-info-isbn",
                    field="identifier",
                    value=value,
                    identifier_scheme="isbn",
                    status="candidate",
                    scope="source_edition",
                    origin="source",
                    evidence=state.blocks[0]["evidence"],
                )
            )
    for claim in claims:
        if claim["field"] in {"title", "contributor"} and any(
            p["status"] == "accepted"
            and p["field"] == claim["field"]
            and _comparison_value(p) != _comparison_value(claim)
            and p.get("contributor_role") == claim.get("contributor_role")
            for p in printed
        ):
            claim["status"] = "conflict"
    for value in printed:
        existing = next(
            (
                c
                for c in claims
                if c["field"] == value["field"]
                and _comparison_value(c) == _comparison_value(value)
                and c.get("contributor_role") == value.get("contributor_role")
            ),
            None,
        )
        if existing is None:
            claims.append(dict(id=f"metadata-printed-{len(claims)}", **value))
        elif value["status"] == "accepted" and existing["status"] != "conflict":
            if existing["status"] == "accepted":
                # Compare credit whitespace only for identity; preserve the first printed spelling.
                evidence = [*existing.get("evidence", []), *value.get("evidence", [])]
                existing["evidence"] = [
                    item for i, item in enumerate(evidence) if item not in evidence[:i]
                ]
            else:
                existing.update(value)
    return claims


def _comparison_value(claim: dict[str, Any]) -> str:
    text = str(claim["value"])
    return " ".join(text.split()) if claim["field"] == "contributor" else text
