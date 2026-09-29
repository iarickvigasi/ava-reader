"""A fixed isolated semantic validator for contact-sheet tasks and returned decisions."""

import hashlib
import json

from .refinement_contract import BookRefinementResponse, BookRefinementTask
from .refinement_response import accept_refinement


def validate_refinement(data: bytes) -> dict[str, object]:
    raw = json.loads(data)
    if set(raw) != {"mode", "task", "response"} or raw["mode"] != "validate_refinement":
        raise ValueError("Invalid refinement validation packet")
    task = BookRefinementTask.model_validate(raw["task"])
    if raw["response"] is not None:
        accept_refinement(task, BookRefinementResponse.model_validate(raw["response"]))
    return {
        "schema_version": "ava-refinement-validation-1",
        "valid": True,
        "request_sha256": hashlib.sha256(data).hexdigest(),
    }
