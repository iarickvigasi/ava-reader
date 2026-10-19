"""Bind the complete source appearance while keeping model context excerpts bounded."""

import hashlib

from .segments import Segment
from .source_feature_task_contract import SourceFeatureNode


def feature_node(segment: Segment, reference: str | None) -> SourceFeatureNode:
    return SourceFeatureNode(
        id=segment.id,
        page=segment.page,
        kind="heading"
        if segment.kind == "heading"
        else "quote"
        if segment.kind == "quote"
        else "paragraph",
        observation_method=segment.method,
        source_box=segment.box,
        text_length=len(segment.text),
        text_sha256=hashlib.sha256(segment.text.encode()).hexdigest(),
        text_excerpt=segment.text[:500],
        observed_level=segment.heading_level,
        observed_chapter=segment.chapter_start,
        observed_role=segment.chapter_role,
        observed_style=segment.style,
        ranked_source=True,
        body_reference_id=reference,
    )
