"""Finite link failure provenance; never text, URLs, raw exceptions or acceptance authority."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Literal

from pydantic import Field

from ..contracts.common import Digest, Record, document_digest
from .prepared_types import AnyPreparedPage

LinkStep = Literal["navigation", "caller", "application"]
LinkCause = Literal[
    "PDF_LINK_ACTION_REQUIRES_REVIEW",
    "PDF_LINK_TARGET_REQUIRES_REVIEW",
    "PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW",
    "PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW",
    "SOURCE_LINK_UNEXPECTED_FAILURE",
]
KNOWN_CAUSES = {
    "PDF_LINK_ACTION_REQUIRES_REVIEW",
    "PDF_LINK_TARGET_REQUIRES_REVIEW",
    "PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW",
    "PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW",
}


class SourceLinkFinding(Record):
    kind: Literal["source_link"] = "source_link"
    code: LinkCause
    link_step: LinkStep
    page: int = Field(ge=1, le=500)
    annotation_number: int = Field(ge=1, le=1000)
    observation_sha256: Digest
    render_sha256: Digest


class SourceLinkRefusal(ValueError):
    def __init__(
        self, checkpoint: AnyPreparedPage, number: int, step: LinkStep, error: Exception
    ) -> None:
        # Preserve the public error code and original exception chain; project no raw message.
        message = str(error) if type(error) is ValueError else ""
        cause = message if message in KNOWN_CAUSES else "SOURCE_LINK_UNEXPECTED_FAILURE"
        super().__init__(str(error))
        self.source_sha256 = checkpoint.source_sha256
        self.finding = SourceLinkFinding.model_validate(
            dict(
                code=cause,
                link_step=step,
                page=checkpoint.observation.number,
                annotation_number=number,
                observation_sha256=document_digest(checkpoint.observation),
                render_sha256=checkpoint.observation.render_sha256,
            )
        )


@contextmanager
def source_link_step(checkpoint: AnyPreparedPage, number: int, step: LinkStep) -> Iterator[None]:
    try:
        yield
    except Exception as error:
        raise SourceLinkRefusal(checkpoint, number, step, error) from error
