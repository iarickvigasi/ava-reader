"""A metadata claim retains the actual printed block's source evidence."""

from typing import Any


def printed_claim(
    field: str, value: str, block: dict[str, Any], status: str = "accepted"
) -> dict[str, Any]:
    return dict(
        field=field,
        value=value[:4000],
        status=status,
        origin="source",
        evidence=block["evidence"],
        scope="source_edition"
        if field in {"publisher", "date", "edition", "identifier"}
        else "work",
    )
