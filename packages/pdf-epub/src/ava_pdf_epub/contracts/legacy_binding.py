"""Caller-owned binding for the unchanged native CLI; never accept this from a reader."""

import re
from typing import Literal, Self

from pydantic import Field, model_validator

from .common import Digest, Record, RelativePath, document_digest
from .job import JobInputV1


class LegacyInvocation(Record):
    job_sha256: Digest
    legacy_job_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    legacy_config_sha256: Digest
    attempt_path: RelativePath
    result_path: RelativePath
    mode: Literal["native"] = "native"

    @model_validator(mode="after")
    def bound_attempt(self) -> Self:
        if not re.search(
            r"(^|/)jobs/" + self.legacy_job_id + r"/attempt-[1-9][0-9]*$", self.attempt_path
        ):
            raise ValueError("Attempt does not belong to legacy invocation")
        return self

    def validate_job(self, job: JobInputV1) -> None:
        if document_digest(job) != self.job_sha256 or job.provider_mode != "native":
            raise ValueError("Legacy invocation does not match trusted job")
