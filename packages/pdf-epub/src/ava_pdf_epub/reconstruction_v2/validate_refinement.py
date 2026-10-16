"""A fixed isolated semantic validator for contact-sheet tasks and returned decisions."""

import hashlib
import json

from .printed_title_contract import PrintedTitleResponse, PrintedTitleTask
from .printed_title_v2_contract import FrontmatterTitleResponse, FrontmatterTitleTask
from .refinement_contract import BookRefinementResponse, BookRefinementTask
from .refinement_response import accept_refinement
from .source_feature_task_contract import SourceFeatureResponse, SourceFeatureTask


def validate_refinement(data: bytes) -> dict[str, object]:
    raw = json.loads(data)
    if set(raw) != {"mode", "task", "response"} or raw["mode"] != "validate_refinement":
        raise ValueError("Invalid refinement validation packet")
    if raw["task"].get("schema_version") == "ava-book-refinement-task-5":
        from .continuation_presentation_contract import (
            PresentationRefinementResponse,
            PresentationRefinementTask,
        )
        from .continuation_presentation_response import presentation_projection

        task5 = PresentationRefinementTask.model_validate(raw["task"])
        if raw["response"] is not None:
            presentation_projection(
                task5, PresentationRefinementResponse.model_validate(raw["response"])
            )
        return {
            "schema_version": "ava-refinement-validation-1",
            "valid": True,
            "request_sha256": hashlib.sha256(data).hexdigest(),
        }
    frontmatter = raw["task"].get("schema_version") == "ava-printed-title-task-2"
    current = raw["task"].get("schema_version") == "ava-book-refinement-task-4"
    title = raw["task"].get("schema_version") == "ava-printed-title-task-1"
    task = (
        FrontmatterTitleTask.model_validate(raw["task"])
        if frontmatter
        else PrintedTitleTask.model_validate(raw["task"])
        if title
        else SourceFeatureTask.model_validate(raw["task"])
        if current or title
        else BookRefinementTask.model_validate(raw["task"])
    )
    if raw["response"] is not None:
        response = (
            FrontmatterTitleResponse.model_validate(raw["response"])
            if frontmatter
            else PrintedTitleResponse.model_validate(raw["response"])
            if title
            else SourceFeatureResponse.model_validate(raw["response"])
            if current or title
            else BookRefinementResponse.model_validate(raw["response"])
        )
        accept_refinement(task, response)
    return {
        "schema_version": "ava-refinement-validation-1",
        "valid": True,
        "request_sha256": hashlib.sha256(data).hexdigest(),
    }
