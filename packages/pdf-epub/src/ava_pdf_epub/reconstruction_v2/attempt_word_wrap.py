"""Post-refinement sparse decisions preserve transport and aggregate response ownership."""

from typing import Any, BinaryIO

from .attempt_exchange import ExchangeWriter, json_bytes
from .page_checkpoints import PageCheckpoints
from .protocol_native_word_wrap import NativeWordWrapReconstructionInput
from .source_preparation import SourcePreparation
from .word_wrap_contract import WordWrapBatch, WordWrapResponse
from .word_wrap_response import validate_word_wrap_response


def attempt_word_wrap(
    preparation: SourcePreparation,
    pages: PageCheckpoints,
    request: NativeWordWrapReconstructionInput,
    writer: ExchangeWriter,
    incoming: BinaryIO,
    response_bytes: int,
    response_limit: int,
) -> list[Any]:
    from .protocol_output import encode_packet
    from .word_wrap_prepare import prepare_word_wrap_from_pages

    batch, assembly, owners = prepare_word_wrap_from_pages(
        preparation.source,
        preparation.scratch,
        pages,
        request,
    )
    del assembly, owners
    batch = WordWrapBatch.model_validate(batch.model_dump())
    if (
        batch.source_sha256 != request.source_sha256
        or batch.profile_id != request.profile_id
        or batch.policy != request.source_normalization_policy
    ):
        raise ValueError("Word-wrap batch belongs to another source/profile/policy")
    encode_packet(batch.model_dump(mode="json"), 8 * 1024 * 1024)
    packet = writer.emit("word_wrap_batch", batch.model_dump(mode="json"))
    if writer.reply(incoming, packet):
        raise ValueError("Word-wrap announcement requires empty acknowledgement")
    preparation.check_unchanged()
    responses: list[Any] = []
    for task in batch.tasks:
        packet = writer.emit("word_wrap", {"task_id": task.task_id})
        returned = writer.reply(incoming, packet)
        preparation.check_unchanged()
        if len(returned) != 1:
            raise ValueError("Word-wrap task/response coverage differs")
        raw = returned[0]
        if len(json_bytes({"task": task.model_dump(mode="json"), "response": raw})) > (
            16 * 1024 * 1024
        ):
            raise ValueError("Word-wrap individual pair byte bound exceeded")
        validate_word_wrap_response(task, WordWrapResponse.model_validate(raw))
        response_bytes += len(json_bytes(raw)) + (1 if responses else 0)
        if response_bytes > response_limit:
            raise ValueError("Combined native/recognition/word-wrap response byte bound exceeded")
        responses.append(raw)
    return responses
