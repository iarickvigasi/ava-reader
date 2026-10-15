"""Shared parser-only eligibility; masking is never an accepted reconstruction."""

import copy
from typing import Any, Literal

from pydantic import ValidationError

from ..contracts.profiles import response_language
from .attempt_exchange import json_bytes, strict_json
from .recognition_anchors import RecognitionTextAnchor, anchored_offsets
from .recognition_contract import RecognitionResponse, RecognitionTask
from .recognition_versions import ANCHORED_PROMPT_VERSIONS
from .validate_tasks import validate_tasks

RESPONSE_BYTES = 8 * 1024 * 1024
SLOT_LIMIT = 512
REASONS: dict[str, Literal["AMBIGUOUS_CONTEXT", "ABSENT_CONTEXT"]] = {
    "Ambiguous exact inline anchor": "AMBIGUOUS_CONTEXT",
    "Inline anchor is absent from exact text": "ABSENT_CONTEXT",
}


def eligible_anchor_response(
    task: RecognitionTask, original_response_json: str
) -> tuple[dict[str, Any], set[int]]:
    task = RecognitionTask.model_validate(task.model_dump())
    if task.prompt_version not in ANCHORED_PROMPT_VERSIONS:
        raise ValueError("ANCHOR_CONTEXT_TASK_NOT_ANCHORED")
    raw = original_response_json.encode()
    if not 0 < len(raw) <= RESPONSE_BYTES:
        raise ValueError("ANCHOR_CONTEXT_RESPONSE_BOUND")
    response = strict_json(raw)
    if not isinstance(response, dict) or (
        response.get("task_id"),
        response.get("source_sha256"),
        response.get("render_sha256"),
    ) != (task.task_id, task.source_sha256, task.image.sha256):
        raise ValueError("ANCHOR_CONTEXT_PARENT_DIFFERS")
    response_language(response.get("language", ""), task.profile_id)
    if response.get("unresolved") or any(
        s.get("kind") == "unsupported" for s in response.get("segments", [])
    ):
        raise ValueError("ANCHOR_CONTEXT_OTHER_UNRESOLVED")
    try:
        RecognitionResponse.model_validate(response)
    except ValidationError as error:
        failures = error.errors(include_input=False, include_url=False)
        if not failures or any(
            len(f["loc"]) != 2
            or f["loc"][0] != "segments"
            or not isinstance(f["loc"][1], int)
            or str(f.get("ctx", {}).get("error")) not in REASONS
            for f in failures
        ):
            raise ValueError("ANCHOR_CONTEXT_NOT_ELIGIBLE") from None
        failed_segments = {int(f["loc"][1]) for f in failures}
    else:
        raise ValueError("ANCHOR_CONTEXT_ALREADY_VALID")
    # Keep every already-resolved span. Only unresolvable pure typography is masked
    # in this eligibility probe; the immutable original and final output keep it.
    # References/annotations cannot lose their evidence to make a probe pass.
    shape = copy.deepcopy(response)
    for index in failed_segments:
        retained = []
        for span in shape["segments"][index]["spans"]:
            try:
                anchored_offsets(
                    shape["segments"][index]["text"],
                    RecognitionTextAnchor.model_validate(span.get("anchor")),
                )
            except ValueError:
                if any(span.get(key) is not None for key in ("url", "note_label", "target_text")):
                    raise ValueError("ANCHOR_CONTEXT_REFERENCE_NOT_ELIGIBLE") from None
            else:
                retained.append(span)
        shape["segments"][index]["spans"] = retained
    validate_tasks(
        json_bytes(
            {
                "mode": "validate_tasks",
                "tasks": [task.model_dump(mode="json")],
                "responses": [shape],
            }
        )
    )
    return response, failed_segments
