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
    from .compile_metadata import compile_metadata
    from .merge_metadata import merge_metadata

    current = state.source_title_policy == "ava-frontmatter-title-1"
    return merge_metadata(
        claims, compile_metadata(printed, state) if current else printed, keep_uncertain=current
    )
