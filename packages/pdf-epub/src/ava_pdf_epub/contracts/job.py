"""Bounded initial-import execution input; no credentials or user billing fields."""

from typing import Literal, Self

from pydantic import Field, model_validator

from .artifacts import Artifact, require_role
from .common import Digest, Id, Record
from .profiles import ProfileId


class JobInputV1(Record):
    schema_version: Literal["ava-pdf-job-1"]
    operation_id: Id
    owner_id: Id
    library_item_id: Id
    intent: Literal["initial_pdf_import"]
    profile_id: ProfileId
    source: Artifact
    request_sha256: Digest
    config_sha256: Digest
    worker_fingerprint: Digest
    generation: int = Field(ge=1, le=9007199254740991)
    attempt_fence: int = Field(ge=1, le=9007199254740991)
    cancellation_epoch: int = Field(ge=0, le=9007199254740991)
    provider_mode: Literal["native", "stub", "replay", "live"]
    dispatch_authority_id: Id | None = None
    active_deadline_seconds: int = Field(ge=1, le=7200)
    source_page_limit: int = Field(ge=1, le=500)
    scratch_byte_limit: int = Field(ge=1, le=2147483648)

    @model_validator(mode="after")
    def source_and_authority(self) -> Self:
        require_role(self.source, "SOURCE_PDF")
        if (self.provider_mode == "live") != (self.dispatch_authority_id is not None):
            raise ValueError("Only live mode requires a server dispatch authority reference")
        return self
