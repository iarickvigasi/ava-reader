"""Public refinement surface: historical authority stays separate from finite OCR features."""

from typing import Literal

from pydantic import Field

from ..contracts.common import Digest, Record
from .legacy_refinement_contract import (
    BibliographicDecision as BibliographicDecision,
)
from .legacy_refinement_contract import (
    BookRefinementResponse as BookRefinementResponse,
)
from .legacy_refinement_contract import (
    BookRefinementTask as BookRefinementTask,
)
from .legacy_refinement_contract import (
    NativeRefinementDecision as NativeRefinementDecision,
)
from .legacy_refinement_contract import (
    OcrRefinementDecision as OcrRefinementDecision,
)
from .legacy_refinement_contract import (
    RefinementCrop as RefinementCrop,
)
from .legacy_refinement_contract import (
    RefinementDecision as RefinementDecision,
)
from .legacy_refinement_contract import (
    RefinementEdge as RefinementEdge,
)
from .legacy_refinement_contract import (
    RefinementJoin as RefinementJoin,
)
from .legacy_refinement_contract import (
    RefinementNode as RefinementNode,
)
from .legacy_refinement_contract import (
    RefinementStyle as RefinementStyle,
)
from .source_feature_task_contract import SourceFeatureResponse as SourceFeatureResponse
from .source_feature_task_contract import SourceFeatureTask as SourceFeatureTask

AnyRefinementTask = BookRefinementTask | SourceFeatureTask
AnyRefinementResponse = BookRefinementResponse | SourceFeatureResponse


class RefinementBatch(Record):
    schema_version: Literal["ava-book-refinement-batch-1"]
    source_sha256: Digest
    tasks: list[AnyRefinementTask] = Field(max_length=32)
