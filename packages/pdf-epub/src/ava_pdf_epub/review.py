"""Explicit, source-revision-bound editorial input, not an instruction-following LLM pass."""

from __future__ import annotations

import hashlib
from typing import Self

from pydantic import Field, model_validator

from .models import Asset, Book, Chapter, Claim, Digest, Id, Record, Span, Style


class BlockEdit(Record):
    block_id: Id
    expected_text_sha256: Digest
    style: Style | None = None
    spans: list[Span] | None = None


class Review(Record):
    schema_version: str = "ava-review-1"
    source_sha256: Digest
    expected_book_sha256: Digest
    reviewer: str = Field(min_length=1, max_length=200)
    chapters: list[Chapter] | None = None
    metadata: list[Claim] | None = None
    block_edits: list[BlockEdit] = Field(default_factory=list)
    assets: list[Asset] | None = None
    cover_asset_id: Id | None = None

    @model_validator(mode="after")
    def known_version(self) -> Self:
        if self.schema_version != "ava-review-1":
            raise ValueError("Unsupported review schema")
        return self


def apply_review(book: Book, review: Review) -> Book:
    serialized = book.model_dump_json().encode()
    if review.source_sha256 != book.source_sha256:
        raise ValueError("Review belongs to a different PDF")
    if review.expected_book_sha256 != hashlib.sha256(serialized).hexdigest():
        raise ValueError("Review was made against a different book revision")
    updated = book.model_dump()
    for field in ("chapters", "metadata", "assets"):
        values = getattr(review, field)
        if values is not None:
            updated[field] = [value.model_dump() for value in values]
    if "cover_asset_id" in review.model_fields_set:
        updated["cover_asset_id"] = review.cover_asset_id
    blocks = {b["id"]: b for p in updated["pages"] for b in p["blocks"]}
    edited: set[str] = set()
    for edit in review.block_edits:
        block = blocks.get(edit.block_id)
        if block is None or edit.block_id in edited:
            raise ValueError("Review contains unknown or repeated block edit")
        edited.add(edit.block_id)
        if hashlib.sha256(block["text"].encode()).hexdigest() != edit.expected_text_sha256:
            raise ValueError("Review spans/style refer to stale text")
        if edit.style is not None:
            block["style"] = edit.style.model_dump()
        if edit.spans is not None:
            block["spans"] = [span.model_dump() for span in edit.spans]
    # Historical issues are deliberately retained: editorial input does not certify OCR accuracy.
    return Book.model_validate(updated)
