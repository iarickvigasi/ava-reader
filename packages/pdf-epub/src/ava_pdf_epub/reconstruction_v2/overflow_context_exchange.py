"""A single context exchange shares the existing consumed-parent opportunity."""

from typing import Any

from .attempt_exchange import ExchangeWriter
from .overflow_context_apply import apply_overflow_context
from .overflow_context_contract import RecognitionOverflowContextTask
from .recognition_anchor_context import RecognitionAnchorContextResponse
from .recognition_anchor_exchange import emit_context, reply_context
from .recognition_contract import RecognitionTask


def accept_overflow_context(
    parent: RecognitionTask,
    task: RecognitionOverflowContextTask,
    writer: ExchangeWriter,
    incoming: Any,
) -> Any:
    packet = emit_context(writer, task)
    response = RecognitionAnchorContextResponse.model_validate(
        reply_context(writer, incoming, packet)
    )
    return apply_overflow_context(parent, task, response)
