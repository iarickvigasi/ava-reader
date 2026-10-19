"""Only the captured continuation route can report more than32 task receipts."""

from typing import Literal

from pydantic import Field

from .refinement_capacity import CURRENT_REFINEMENT_TASK_LIMIT
from .report_contract import ReconstructionReport, RefinementEvidence


class ContinuationReconstructionReport(ReconstructionReport):
    schema_version: Literal["ava-reconstruction-report-3"]  # type: ignore[assignment]
    source_continuation_policy: Literal["ava-source-continuation-presentation-1"]
    refinement_evidence: list[RefinementEvidence] = Field(
        default_factory=list, max_length=CURRENT_REFINEMENT_TASK_LIMIT
    )


AnyReconstructionReport = ReconstructionReport | ContinuationReconstructionReport
