"""Full immutable reader package; windowing must not truncate the manifest."""

from typing import Literal, Self

from pydantic import Field, model_validator

from .book import CanonicalBookV2
from .common import Digest, Id, Record, document_digest, unique

Capability = Literal[
    "text",
    "styles",
    "links",
    "notes",
    "figures",
    "tables",
    "lists",
    "literal-text",
    "annotation-styles",
    "language",
    "source-page-starts",
]


class ReaderPackageV3(Record):
    schema_version: Literal["ava-reader-3"]
    version: Literal[3]
    final_content_id: Id
    canonical_hash_algorithm: Literal["ava-json-v1"]
    canonical_sha256: Digest
    required_capabilities: list[Capability] = Field(min_length=1, max_length=11)
    book: CanonicalBookV2

    @model_validator(mode="after")
    def content_identity(self) -> Self:
        if document_digest(self.book) != self.canonical_sha256:
            raise ValueError("Reader canonical document digest mismatch")
        unique(list(self.required_capabilities), "reader capability")
        from .capabilities import required_capabilities

        if set(self.required_capabilities) != required_capabilities(self.book):
            raise ValueError("Required capabilities must exactly describe canonical content")
        return self
