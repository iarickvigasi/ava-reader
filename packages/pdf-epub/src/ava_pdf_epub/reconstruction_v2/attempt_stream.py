"""One bounded attempt owns source checkpoints; the host retains provider authority."""

import tempfile
from collections.abc import Iterator
from contextlib import ExitStack, contextmanager
from pathlib import Path
from typing import Any, BinaryIO

from ..worker_observation import observe, phase
from .attempt_exchange import ExchangeWriter, json_bytes, strict_json, write_bytes
from .page_checkpoints import PageCheckpoints
from .prepare_page import prepare_from_source
from .prepare_refinement_source import prepare_refinement_from_pages
from .protocol import (
    AnyReconstructionInput,
    ReconstructionInput,
    prepared_result,
    reconstruction_input,
)
from .protocol_native_layout import NativeLayoutReconstructionInput
from .protocol_output import encode_packet
from .qualify_embedded_images import qualify_embedded_images
from .qualify_native_layout import qualify_native_layout
from .recognition_anchor_exchange import accept_attempt_recognition
from .reconstruct_source import reconstruct_from_pages
from .source_preparation import SourcePreparation
from .source_refusal import SourceContentRefusal
from .stream_output import stream_artifacts
from .validate_refinement import validate_refinement
from .validate_tasks import validate_tasks

REQUEST_BYTES = 64 * 1024 * 1024
RECOGNITION_BYTES = 60 * 1024 * 1024
REFINEMENT_VALIDATION_BYTES = 8 * 1024 * 1024
ERROR = {"schema_version": "ava-reconstruction-error-1", "code": "RECONSTRUCTION_REVIEW_REQUIRED"}


class AttemptFailure(ValueError):
    """A framed terminal refusal was emitted; the entrypoint must not print a second packet."""

    def __init__(self, cause: Exception):
        super().__init__("Attempt reconstruction refused")
        self.cause = cause


def initial_input(data: bytes) -> ReconstructionInput | NativeLayoutReconstructionInput:
    if not 0 < len(data) <= REQUEST_BYTES:
        raise ValueError("Attempt request byte bound exceeded")
    raw = strict_json(data)
    if not isinstance(raw, dict) or set(raw) != {"mode", "input"}:
        raise ValueError("Invalid attempt request fields")
    if raw["mode"] != "attempt_stream" or not isinstance(raw["input"], dict):
        raise ValueError("Invalid attempt request mode/input")
    required = {"schema_version", "profile_id", "source_sha256", "responses", "refinements"}
    layout = raw["input"].get("schema_version") == "ava-reconstruct-input-3"
    valid = (
        (required | {"source_feature_policy", "source_layout_policy"},)
        if layout
        else (required, required | {"source_feature_policy"})
    )
    if set(raw["input"]) not in valid:
        raise ValueError("Invalid initial reconstruction input fields")
    request = (
        NativeLayoutReconstructionInput.model_validate(raw["input"])
        if layout
        else (ReconstructionInput.model_validate(raw["input"]))
    )
    if (
        request.responses
        or request.refinements
        or ("source_feature_policy" in raw["input"] and request.source_feature_policy is None)
    ):
        raise ValueError("Attempt cannot consume prior recognition/refinement decisions")
    return request


def _input(
    initial: ReconstructionInput | NativeLayoutReconstructionInput,
    responses: list[Any],
    refinements: list[Any],
) -> AnyReconstructionInput:
    # Each phase validates new models from raw receipts. No mutable response or
    # assembly object created during comparison is reused for final assembly.
    raw = {**initial.model_dump(mode="json"), "responses": responses, "refinements": refinements}
    if not isinstance(initial, NativeLayoutReconstructionInput) and any(
        isinstance(r, dict) and r.get("schema_version") == "ava-printed-title-response-1"
        for r in refinements
    ):
        raw["schema_version"] = "ava-reconstruct-input-2"
    encode_packet({"mode": "reconstruct_stream", "input": raw}, REQUEST_BYTES)
    return reconstruction_input(raw)


def _validate_refinement(task: Any, response: Any) -> None:
    data = json_bytes({"mode": "validate_refinement", "task": task, "response": response})
    if len(data) > REFINEMENT_VALIDATION_BYTES:
        raise ValueError("Refinement validation request byte bound exceeded")
    validate_refinement(data)


@contextmanager
def _prepared_attempt(
    source: Path, scratch: Path, request: AnyReconstructionInput
) -> Iterator[tuple[SourcePreparation, PageCheckpoints]]:
    # The one phase contains active preparation only, never host/model waits.
    # Once it ends the guard remains owned, but all decoded parsers are retired.
    with ExitStack() as owner:
        with phase("prepare_source"):
            preparation = owner.enter_context(
                SourcePreparation(
                    source,
                    scratch,
                    request.profile_id,
                    request.source_sha256,
                    source_feature_policy=request.source_feature_policy,
                    source_layout_policy=(
                        request.source_layout_policy
                        if isinstance(request, NativeLayoutReconstructionInput)
                        else None
                    ),
                )
            )
            pages = PageCheckpoints(
                Path(tempfile.mkdtemp(prefix="observations-", dir=scratch)),
                preparation.source_layout_policy,
            )
            seen_tasks: set[str] = set()
            for number in range(1, preparation.count + 1):
                page = prepare_from_source(preparation, number)
                if (
                    page.source_sha256 != request.source_sha256
                    or page.profile_id != request.profile_id
                    or page.source_page_count != preparation.count
                    or page.source_byte_length != preparation.size
                ):
                    raise ValueError("Prepared page belongs to another source/profile")
                encode_packet(prepared_result(page).model_dump(mode="json"), 8 * 1024 * 1024)
                for task in page.tasks:
                    if (
                        task.source_sha256 != request.source_sha256
                        or task.profile_id != request.profile_id
                        or task.page_number != number
                        or task.task_id in seen_tasks
                    ):
                        raise ValueError("Recognition task source/profile/page identity differs")
                    seen_tasks.add(task.task_id)
                validate_tasks(
                    json_bytes(
                        {
                            "mode": "validate_tasks",
                            "tasks": [task.model_dump(mode="json") for task in page.tasks],
                        }
                    )
                )
                pages.append(page)
                del page
            qualify_embedded_images(pages, scratch, request.source_feature_policy)
            qualify_native_layout(pages, scratch, preparation.source_layout_policy)
            preparation.verify_inputs()
            preparation.retire_parsers()
        yield preparation, pages


def _run(
    source: Path,
    scratch: Path,
    request: ReconstructionInput | NativeLayoutReconstructionInput,
    incoming: BinaryIO,
    outgoing: BinaryIO,
    writer: ExchangeWriter,
) -> None:
    responses: list[Any] = []
    response_bytes = 2  # The recognition response array, including separators.
    scratch.mkdir(parents=True, exist_ok=True)
    with _prepared_attempt(source, scratch, request) as (preparation, pages):
        for page in pages:
            page_result = prepared_result(page)
            packet = writer.emit("page", page_result.model_dump(mode="json"))
            if writer.reply(incoming, packet):
                raise ValueError("Page announcement requires empty acknowledgement")
            preparation.check_unchanged()
            for recognition_task in page.tasks:
                task_wire = recognition_task.model_dump(mode="json")
                packet = writer.emit("recognition", {"task_id": recognition_task.task_id})
                returned = writer.reply(incoming, packet)
                preparation.check_unchanged()
                if len(returned) != 1 or len(responses) >= 25000:
                    raise ValueError("Recognition task/response coverage differs")
                response = accept_attempt_recognition(
                    recognition_task,
                    returned[0],
                    writer,
                    incoming,
                    isinstance(request, NativeLayoutReconstructionInput),
                )
                # Keep the old individual pair16MiB limit, not a whole-page limit.
                validate_tasks(
                    json_bytes(
                        {"mode": "validate_tasks", "tasks": [task_wire], "responses": [response]}
                    )
                )
                response_bytes += len(json_bytes(response)) + (1 if responses else 0)
                if response_bytes > RECOGNITION_BYTES:
                    raise ValueError("Recognition aggregate response byte bound exceeded")
                responses.append(response)
            del page_result
        del page
        preparation.verify_inputs()
        pages.verify()
        pages.clear_cache()
        observe("attempt_preparation_reuse")
        batch = prepare_refinement_from_pages(
            source, scratch, pages, _input(request, responses, [])
        )
        if batch.source_sha256 != request.source_sha256 or len(
            {task.task_id for task in batch.tasks}
        ) != len(batch.tasks):
            raise ValueError("Refinement batch source/task identity differs")
        encode_packet(batch.model_dump(mode="json"), 24 * 1024 * 1024)
        for refinement_task in batch.tasks:
            if (
                refinement_task.source_sha256 != request.source_sha256
                or refinement_task.profile_id != request.profile_id
            ):
                raise ValueError("Refinement task belongs to another source/profile")
            _validate_refinement(refinement_task.model_dump(mode="json"), None)
        packet = writer.emit("refinement_batch", batch.model_dump(mode="json"))
        if writer.reply(incoming, packet):
            raise ValueError("Refinement announcement requires empty acknowledgement")
        preparation.check_unchanged()
        refinements = []
        for refinement_task in batch.tasks:
            packet = writer.emit("refinement", {"task_id": refinement_task.task_id})
            returned = writer.reply(incoming, packet)
            preparation.check_unchanged()
            if len(returned) != 1:
                raise ValueError("Refinement task/response coverage differs")
            response = returned[0]
            _validate_refinement(refinement_task.model_dump(mode="json"), response)
            refinements.append(response)
        if incoming.read(1):
            raise ValueError("Attempt received trailing reply bytes")
        complete = _input(request, responses, refinements)
        del batch, responses, refinements
        preparation.verify_inputs()
        pages.verify()
        pages.clear_cache()
        candidate, report = reconstruct_from_pages(source, scratch, pages, complete)
        del complete
        preparation.verify_inputs()
        pages.verify()
        if (
            candidate.book.source.sha256 != request.source_sha256
            or candidate.book.profile_id != request.profile_id
            or candidate.book.source.page_count != preparation.count
            or candidate.book.source.byte_length != preparation.size
        ):
            raise ValueError("Final reconstruction source/profile identity differs")
        records = iter(stream_artifacts(candidate, report))
        first = next(records)  # Check manifest/artifact bounds before switching the wire format.
        writer.emit("artifacts", None)
        write_bytes(outgoing, first)
        for record in records:
            write_bytes(outgoing, record)


def attempt_stream(
    source: Path, scratch: Path, data: bytes, incoming: BinaryIO, outgoing: BinaryIO
) -> None:
    request = initial_input(data)
    writer = ExchangeWriter(outgoing, request.source_sha256, request.profile_id)
    try:
        _run(source, scratch, request, incoming, outgoing, writer)
    except Exception as error:
        if not writer.terminal:
            payload = (
                error.diagnostic.model_dump(mode="json")
                if isinstance(error, SourceContentRefusal)
                else ERROR
            )
            writer.emit("refusal", payload)
        raise AttemptFailure(error) from error
