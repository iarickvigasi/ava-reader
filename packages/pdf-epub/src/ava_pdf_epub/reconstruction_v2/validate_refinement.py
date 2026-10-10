"""A fixed isolated semantic validator for contact-sheet tasks and returned decisions."""

import hashlib
import json

from .refinement_contract import BookRefinementResponse, BookRefinementTask
from .refinement_response import accept_refinement
from .source_feature_task_contract import SourceFeatureResponse, SourceFeatureTask


def validate_refinement(data: bytes) -> dict[str, object]:
    raw = json.loads(data)
    if set(raw) != {"mode", "task", "response"} or raw["mode"] != "validate_refinement":
        raise ValueError("Invalid refinement validation packet")
    current = raw["task"].get("schema_version") == "ava-book-refinement-task-4"
    task = (
        SourceFeatureTask.model_validate(raw["task"])
        if current
        else BookRefinementTask.model_validate(raw["task"])
    )
    if raw["response"] is not None:
        response = (
            SourceFeatureResponse.model_validate(raw["response"])
            if current
            else BookRefinementResponse.model_validate(raw["response"])
        )
        accept_refinement(task, response)
    return {
        "schema_version": "ava-refinement-validation-1",
        "valid": True,
        "request_sha256": hashlib.sha256(data).hexdigest(),
    }
