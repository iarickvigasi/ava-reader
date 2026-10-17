"""Server-owned first-publication record; validating this is not authorization."""

from typing import Literal, Self

from pydantic import Field, model_validator

from .artifacts import Artifact, bound_artifacts, distinct_artifacts, require_role
from .common import Digest, Id, Record
from .profiles import ProfileId


class AcceptedContentV1(Record):
    schema_version: Literal["ava-accepted-content-1"]
    authority: Literal["server_first_publication"]
    operation_id: Id
    owner_id: Id
    library_item_id: Id
    final_content_id: Id
    profile_id: ProfileId
    canonical_schema: Literal["ava-book-2"]
    reader_schema: Literal["ava-reader-3"]
    source: Artifact
    canonical_book: Artifact
    reader_package: Artifact
    epub: Artifact
    validation_report: Artifact
    resources: list[Artifact] = Field(max_length=1000)
    config_sha256: Digest
    capability_report_sha256: Digest
    adapter_fingerprint: Digest
    reader_build_fingerprint: Digest
    publication_fence: int = Field(ge=1, le=9007199254740991)
    cancellation_epoch: int = Field(ge=0, le=9007199254740991)

    @model_validator(mode="after")
    def accepted_roles(self) -> Self:
        required = [
            (self.source, "SOURCE_PDF"),
            (self.canonical_book, "CANONICAL_BOOK"),
            (self.reader_package, "DERIVED_READER"),
            (self.epub, "DERIVED_EPUB"),
            (self.validation_report, "VALIDATION_REPORT"),
        ]
        for artifact, role in required:
            require_role(artifact, role)
        for resource in self.resources:
            require_role(resource, "RESOURCE")
        distinct_artifacts([a for a, _ in required] + self.resources)
        bound_artifacts([a for a, _ in required] + self.resources)
        return self
