"""Preserve source metadata with provenance; do not promote unprinted conflicts to facts."""

from pathlib import Path
from typing import Any

from pypdf import PdfReader

from .assembly_state import AssemblyState
from .metadata_scope import metadata_scope
from .printed_identifiers import explicit_isbns
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
    for index, value in enumerate(explicit_isbns(subject)):
        claims.append(
            dict(
                id="metadata-info-isbn" if index == 0 else f"metadata-info-isbn-{index}",
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
                and c.get("scope") == value.get("scope")
                and c.get("identifier_scheme") == value.get("identifier_scheme")
            ),
            None,
        )
        if existing is None:
            claims.append(dict(id=f"metadata-printed-{len(claims)}", **value))
        elif value["status"] == "accepted" and existing["status"] not in {"accepted", "conflict"}:
            existing.update(value)
        else:
            # New source evidence strengthens provenance without promoting uncertain facts.
            evidence = [*existing.get("evidence", []), *value.get("evidence", [])]
            existing["evidence"] = [
                item for i, item in enumerate(evidence) if item not in evidence[:i]
            ]
    return claims


def _comparison_value(claim: dict[str, Any]) -> str:
    text = str(claim["value"])
    return " ".join(text.split()) if claim["field"] == "contributor" else text
