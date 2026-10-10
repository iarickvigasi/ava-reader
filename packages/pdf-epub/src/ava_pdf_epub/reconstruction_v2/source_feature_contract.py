"""Finite source comparisons cannot authorize text, anchors or chapter replacement."""

from typing import Annotated, Literal

from pydantic import Field, StrictBool

from ..contracts.common import Digest, Id, Record
from ..contracts.source import Box

FEATURE_POLICY: Literal["ava-ocr-source-features-1"] = "ava-ocr-source-features-1"
Feature = Literal[
    "paragraph_role",
    "family",
    "weight",
    "italic",
    "first_line_indent",
    "block_inset",
    "relative_size",
]
FeatureValue = (
    Literal["paragraph", "quote", "serif", "sans-serif", "monospace"]
    | StrictBool
    | Annotated[float, Field(strict=True)]
    | None
)


class SourceFeatureRequest(Record):
    node_id: Id
    page: int = Field(ge=1, le=500)
    source_box: Box
    column_box: Box
    requested_features: list[Feature] = Field(min_length=1, max_length=7)
    allowed_roles: list[Literal["paragraph", "quote"]] = Field(max_length=2)
    reference_ids: list[Id] = Field(min_length=1, max_length=3)
    selection_reason: Literal[
        "isolated_prose", "declared_quote", "heading_comparison", "appearance_comparison"
    ]


class SourceFeatureObservation(Record):
    feature: Feature
    disposition: Literal["observed", "unknown", "not_applicable"]
    value: FeatureValue
    reason: (
        Literal[
            "source_blurred",
            "source_clipped",
            "source_context_insufficient",
            "heading_has_no_prose_first_line",
        ]
        | None
    )
    evidence_ids: list[Id] = Field(min_length=1, max_length=4)


class SourceFeatureDecision(Record):
    node_id: Id
    text_sha256: Digest
    features: list[SourceFeatureObservation] = Field(min_length=1, max_length=7)
