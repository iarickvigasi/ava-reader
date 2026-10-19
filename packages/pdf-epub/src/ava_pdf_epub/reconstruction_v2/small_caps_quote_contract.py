"""An explicit current small-caps quotation task; historical Task2 stays closed."""

from typing import Literal, Self

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.profiles import ProfileId
from .anchor_quote_binding import quote_binding
from .attempt_exchange import strict_json
from .recognition_anchor_candidates import allowed_quotations
from .recognition_anchor_eligibility import RESPONSE_BYTES, SLOT_LIMIT
from .recognition_anchor_quote_contract import (
    ANCHOR_QUOTE_PROMPT,
    AnchorQuoteSlot,
    RecognitionAnchorQuoteTask,
)
from .recognition_contract import RecognitionImage
from .small_caps_quote_candidates import small_caps_quotations

SMALL_CAPS_QUOTE_PROMPT_VERSION = "ava-recognition-anchor-quote-3"
SMALL_CAPS_QUOTE_PROMPT = ANCHOR_QUOTE_PROMPT + (
    "\nA lowercase ASCII small-cap anchor may offer its literal uppercase whole-token "
    "spelling from the unchanged owning text. Choose only the supplied quotation and use the image "
    "to locate its styled occurrence. This never authorizes changing the owner's letter case "
    "or any style."
)


class RecognitionSmallCapsQuoteTask(Record):
    schema_version: Literal["ava-recognition-anchor-quote-task-3"]
    task_id: Id
    purpose: Literal["repair_inline_anchor_quote"]
    prompt_version: Literal["ava-recognition-anchor-quote-3"]
    response_schema_version: Literal["ava-recognition-anchor-quote-response-2"]
    source_sha256: Digest
    profile_id: ProfileId
    page_number: int = Field(ge=1, le=500)
    original_task_id: Id
    render_sha256: Digest
    native_evidence_sha256: Digest
    original_response_json: str = Field(min_length=2, max_length=RESPONSE_BYTES)
    original_response_sha256: Digest
    image: RecognitionImage
    slots: list[AnchorQuoteSlot] = Field(min_length=1, max_length=SLOT_LIMIT)

    @model_validator(mode="after")
    def binding(self) -> Self:
        quote_binding(self.model_dump(mode="json"), small_caps_quotations)
        original = strict_json(self.original_response_json.encode())
        if not any(
            not allowed_quotations(
                original["segments"][s.segment_index]["text"],
                strict_json(s.original_span_json.encode()),
            )
            for s in self.slots
        ):
            raise ValueError("SMALL_CAPS_QUOTE_REQUIRES_DISTINCT_CASE_ALTERNATIVE")
        return self


QuoteRepairTask = RecognitionAnchorQuoteTask | RecognitionSmallCapsQuoteTask
