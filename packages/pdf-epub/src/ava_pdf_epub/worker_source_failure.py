"""Only typed source-bound refusals gain content-free diagnostic findings."""

from .contracts.common import Digest
from .reconstruction_v2.join_typography_refusal import JoinTypographyFinding, JoinTypographyRefusal
from .reconstruction_v2.refinement_validation_refusal import (
    RefinementValidationFinding,
    RefinementValidationRefusal,
)
from .reconstruction_v2.source_link_refusal import SourceLinkFinding, SourceLinkRefusal
from .reconstruction_v2.source_refusal import SourceContentRefusal


def source_failure(
    error: BaseException, source_sha256: Digest
) -> tuple[str, list[dict[str, object]], bool] | None:
    if (
        isinstance(error, (SourceLinkRefusal, JoinTypographyRefusal))
        and error.source_sha256 == source_sha256
    ):
        model = SourceLinkFinding if isinstance(error, SourceLinkRefusal) else JoinTypographyFinding
        finding = model.model_validate(error.finding.model_dump(mode="json"))
        return "RECONSTRUCTION_REVIEW_REQUIRED", [finding.model_dump(mode="json")], True
    if isinstance(error, RefinementValidationRefusal) and error.source_sha256 == source_sha256:
        semantic_finding = RefinementValidationFinding.model_validate(
            error.finding.model_dump(mode="json")
        )
        return "RECONSTRUCTION_REVIEW_REQUIRED", [semantic_finding.model_dump(mode="json")], True
    if isinstance(error, SourceContentRefusal) and error.diagnostic.source_sha256 == source_sha256:
        return (
            error.diagnostic.findings[0].code,
            [
                {"kind": "source", **finding.model_dump(mode="json")}
                for finding in error.diagnostic.findings[:2]
            ],
            len(error.diagnostic.findings) <= 2,
        )
    return None
