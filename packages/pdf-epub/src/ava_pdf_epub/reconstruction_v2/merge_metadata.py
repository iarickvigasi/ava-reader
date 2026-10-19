"""Merge source facts without erasing unconfirmed current-policy claims."""

from typing import Any


def merge_metadata(
    claims: list[dict[str, Any]], printed: list[dict[str, Any]], *, keep_uncertain: bool = False
) -> list[dict[str, Any]]:
    for claim in claims:
        matches = [
            p
            for p in printed
            if p["status"] == "accepted"
            and p["field"] == claim["field"]
            and p.get("contributor_role") == claim.get("contributor_role")
        ]
        if claim["field"] not in {"title", "contributor"}:
            continue
        if keep_uncertain:
            matches = [
                p
                for p in matches
                if p.get("scope") == claim.get("scope")
                and p.get("identifier_scheme") == claim.get("identifier_scheme")
            ]
            conflict = bool(matches) and not any(
                _comparison_value(p, True) == _comparison_value(claim, True) for p in matches
            )
        else:
            conflict = any(_comparison_value(p) != _comparison_value(claim) for p in matches)
        if conflict:
            claim["status"] = "conflict"
    for value in printed:
        existing = next(
            (
                c
                for c in claims
                if c["field"] == value["field"]
                and _comparison_value(c, keep_uncertain) == _comparison_value(value, keep_uncertain)
                and c.get("contributor_role") == value.get("contributor_role")
                and c.get("scope") == value.get("scope")
                and c.get("identifier_scheme") == value.get("identifier_scheme")
                and (
                    not keep_uncertain
                    or (c["status"] == value["status"] and c["origin"] == value["origin"])
                )
            ),
            None,
        )
        if existing is None:
            claims.append(dict(id=f"metadata-printed-{len(claims)}", **value))
        elif value["status"] == "accepted" and existing["status"] not in {"accepted", "conflict"}:
            existing.update(value)
        else:
            # New source evidence strengthens provenance without promoting uncertain facts.
            if keep_uncertain and value["status"] == "accepted":
                existing["value"] = value["value"]
            evidence = [*existing.get("evidence", []), *value.get("evidence", [])]
            existing["evidence"] = [
                item for i, item in enumerate(evidence) if item not in evidence[:i]
            ]
    return claims


def _comparison_value(claim: dict[str, Any], current: bool = False) -> str:
    from .metadata_equivalence import TEXT_FIELDS, metadata_value

    text = str(claim["value"])
    if current and claim["field"] in TEXT_FIELDS:
        return metadata_value(text)
    return " ".join(text.split()) if claim["field"] == "contributor" else text
