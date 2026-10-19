"""Finite source-derived presentation, authorized only by the new continuation contract."""

import hashlib
import json
from typing import Any, Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.styles import Style
from .legacy_refinement_contract import (
    BookRefinementResponse,
    BookRefinementTask,
    RefinementDecision,
)

POLICY = "ava-source-continuation-presentation-1"
PROMPT_VERSION = "ava-book-refinement-8"


def candidate_digest(values: dict[str, Any]) -> str:
    return hashlib.sha256(
        json.dumps(
            values, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
        ).encode()
    ).hexdigest()


class UniformJoinCandidate(Record):
    id: Id
    edge_id: Id
    previous_id: Id
    next_id: Id
    previous_text_sha256: Digest
    next_text_sha256: Digest
    previous_style_sha256: Digest
    next_style_sha256: Digest
    native_id: Id
    native_alignment_fallback: bool
    previous_style: Style
    next_style: Style

    @model_validator(mode="after")
    def identity(self) -> "UniformJoinCandidate":
        if self.id != "join-style-" + candidate_digest(
            self.model_dump(mode="json", exclude={"id"})
        ):
            raise ValueError("Continuation presentation identity differs")
        return self


class JoinPresentationChoice(Record):
    edge_id: Id
    candidate_id: Id | None
    evidence_ids: list[Id] = Field(max_length=4)


class PresentationRefinementTask(BookRefinementTask):
    schema_version: Literal["ava-book-refinement-task-5"]  # type: ignore[assignment]
    prompt_version: Literal["ava-book-refinement-8"]  # type: ignore[assignment]
    response_schema_version: Literal["ava-book-refinement-response-5"]  # type: ignore[assignment]
    native_endpoints: list[Id] = Field(min_length=1, max_length=16)
    native_alignment_fallbacks: list[Id] = Field(max_length=16)
    join_candidates: list[UniformJoinCandidate] = Field(min_length=1, max_length=16)

    @model_validator(mode="after")
    def presentation_scope(self) -> "PresentationRefinementTask":
        from .continuation_presentation import validate_candidates

        validate_candidates(self)
        return self


class PresentationRefinementResponse(BookRefinementResponse):
    schema_version: Literal["ava-book-refinement-response-5"]  # type: ignore[assignment]
    decisions: list[RefinementDecision] = Field(max_length=24)  # type: ignore[assignment]
    presentations: list[JoinPresentationChoice] = Field(max_length=16)
