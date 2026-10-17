"""Narrow case equivalence is not spelling correction, transliteration or identifier folding."""

from typing import Any

TEXT_FIELDS = {"title", "subtitle", "contributor", "publisher"}


def metadata_value(value: str) -> str:
    text = " ".join(value.split())
    return "".join(c.lower() if len(c.lower()) == 1 else c for c in text)


def metadata_key(claim: dict[str, Any]) -> tuple[str, ...] | None:
    if (
        claim["status"] != "accepted"
        or claim["origin"] != "source"
        or claim["field"] not in TEXT_FIELDS
    ):
        return None
    return (
        claim["field"],
        claim["scope"],
        claim.get("contributor_role") or "",
        claim.get("identifier_scheme") or "",
        metadata_value(claim["value"]),
    )


def metadata_evidence(claims: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for claim in claims:
        for item in claim.get("evidence", []):
            if item not in output:
                output.append(item)
    return output
