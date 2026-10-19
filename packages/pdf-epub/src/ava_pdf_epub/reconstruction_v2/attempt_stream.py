"""One bounded attempt owns source checkpoints; the host retains provider authority."""

import tempfile
from collections.abc import Iterator
from contextlib import ExitStack, contextmanager
from pathlib import Path
from typing import Any, BinaryIO

from ..worker_observation import observe, phase
from .attempt_complete_input import attempt_complete_input as _input
from .attempt_exchange import ExchangeWriter, json_bytes, write_bytes
from .attempt_initial_input import InitialInput
from .attempt_initial_input import initial_input as initial_input
from .attempt_recognition_geometry import accept_geometry_attempt
from .attempt_word_wrap import attempt_word_wrap
from .native_structure_assembly import assemble_native_structure_source
from .native_structure_contract import NativeStructureResponse
from .native_structure_exchange import emit_native, reply_native
from .native_structure_v2_contract import NativeStructureResponse2, NativeStructureTask2
from .native_structure_versions import NATIVE_TASK_TYPES
from .page_checkpoints import PageCheckpoints
from .prepare_page import prepare_from_source
from .prepare_refinement_source import prepare_refinement_from_pages
from .prepared_native_structure import NativeStructurePreparedPage
from .prepared_native_structure_v2 import NativeStructure2PreparedPage
from .printed_title_v2_contract import FrontmatterTitleTask
from .protocol import (
    AnyReconstructionInput,
    prepared_result,
)
from .protocol_cell_geometry import CellGeometryReconstructionInput
from .protocol_continuation import ContinuationReconstructionInput, ContinuationRefinementBatch
from .protocol_frontmatter_title import (
    FrontmatterTitleReconstructionInput,
    FrontmatterTitleRefinementBatch,
)
from .protocol_native_layout import NativeLayoutReconstructionInput
from .protocol_native_structure import NativeStructureReconstructionInput
from .protocol_native_structure_v2 import NativeStructure2ReconstructionInput
from .protocol_native_word_wrap import NativeWordWrapReconstructionInput
from .protocol_output import encode_packet
from .protocol_recognition_geometry import RecognitionGeometryReconstructionInput
from .qualify_embedded_images import qualify_embedded_images
from .qualify_native_layout import qualify_native_layout
from .recognition_anchor_exchange import accept_attempt_recognition
from .reconstruct_source import reconstruct_from_pages
from .source_preparation import SourcePreparation
from .source_refusal import SourceContentRefusal
from .stream_output import stream_artifacts
from .validate_refinement import validate_refinement
from .validate_tasks import validate_tasks

RECOGNITION_BYTES = 60 * 1024 * 1024
REFINEMENT_VALIDATION_BYTES = 8 * 1024 * 1024
ERROR = {"schema_version": "ava-reconstruction-error-1", "code": "RECONSTRUCTION_REVIEW_REQUIRED"}


class AttemptFailure(ValueError):
    """A framed terminal refusal was emitted; the entrypoint must not print a second packet."""

    def __init__(self, cause: Exception):
        super().__init__("Attempt reconstruction refused")
        self.cause = cause


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
                        if isinstance(
                            request,
                            (
                                NativeLayoutReconstructionInput,
                                NativeStructureReconstructionInput,
                                NativeWordWrapReconstructionInput,
                            ),
                        )
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
            if isinstance(
                request, (NativeStructureReconstructionInput, NativeWordWrapReconstructionInput)
            ):
                from .qualify_native_structure import qualify_native_structure

                qualify_native_structure(
                    pages,
                    scratch,
                    request.source_structure_policy,
                    source_normalization_policy=(
                        request.source_normalization_policy
                        if isinstance(request, NativeWordWrapReconstructionInput)
                        else None
                    ),
                )
                if isinstance(request, NativeWordWrapReconstructionInput):
                    from .qualify_native_word_wrap import qualify_native_word_wrap

                    qualify_native_word_wrap(pages, scratch, request.source_normalization_policy)
                for qualified in pages:
                    encode_packet(
                        prepared_result(qualified).model_dump(mode="json"), 8 * 1024 * 1024
                    )
            preparation.verify_inputs()
            preparation.retire_parsers()
        yield preparation, pages


def _run(
    source: Path,
    scratch: Path,
    request: InitialInput,
    incoming: BinaryIO,
    outgoing: BinaryIO,
    writer: ExchangeWriter,
) -> None:
    responses: list[Any] = []
    native_responses: list[Any] = []
    geometry_corrections: list[Any] = []
    response_bytes = (
        8
        if isinstance(request, RecognitionGeometryReconstructionInput)
        else 6
        if isinstance(request, NativeWordWrapReconstructionInput)
        else 4
        if isinstance(request, NativeStructureReconstructionInput)
        else 2
    )
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
                if isinstance(recognition_task, NATIVE_TASK_TYPES):
                    if not isinstance(
                        request,
                        (NativeStructureReconstructionInput, NativeWordWrapReconstructionInput),
                    ) or not isinstance(page, NativeStructurePreparedPage):
                        raise ValueError(
                            "Native structure task requires its selected input/page versions"
                        )
                    native2 = isinstance(recognition_task, NativeStructureTask2)
                    if native2 != isinstance(
                        request, NativeStructure2ReconstructionInput
                    ) or native2 != isinstance(page, NativeStructure2PreparedPage):
                        raise ValueError(
                            "Native task version differs from selected input/checkpoint"
                        )
                    packet_native = emit_native(
                        writer, recognition_task.task_id, version=2 if native2 else 1
                    )
                    response = reply_native(writer, incoming, packet_native)
                    preparation.check_unchanged()
                    if len(responses) + len(native_responses) >= 25000:
                        raise ValueError("Combined native/recognition task coverage exceeds bound")
                    if (
                        len(json_bytes({"task": task_wire, "response": response}))
                        > 16 * 1024 * 1024
                    ):
                        raise ValueError("Native structure individual pair byte bound exceeded")
                    receipt = (
                        NativeStructureResponse2.model_validate(response)
                        if native2
                        else NativeStructureResponse.model_validate(response)
                    )
                    furniture = {
                        ident
                        for r in recognition_task.regions
                        if r.source.role == "furniture"
                        for ident in r.line_ids
                    }
                    # Validate real source conservation before advertising another paid task.
                    assemble_native_structure_source(
                        recognition_task,
                        receipt,
                        page.observation,
                        preserved_segments=page.native_segments,
                        furniture=furniture,
                    )
                    response_bytes += len(json_bytes(response)) + (1 if native_responses else 0)
                    if response_bytes > RECOGNITION_BYTES:
                        raise ValueError("Combined native/recognition response byte bound exceeded")
                    native_responses.append(response)
                    continue
                packet = writer.emit("recognition", {"task_id": recognition_task.task_id})
                returned = writer.reply(incoming, packet)
                preparation.check_unchanged()
                if len(returned) != 1 or len(responses) + len(native_responses) >= 25000:
                    raise ValueError("Recognition task/response coverage differs")
                if isinstance(request, RecognitionGeometryReconstructionInput):
                    response, proof = accept_geometry_attempt(
                        recognition_task,
                        returned[0],
                        writer,
                        incoming,
                        allow_cells=isinstance(request, CellGeometryReconstructionInput),
                        allow_overflow=isinstance(request, ContinuationReconstructionInput),
                    )
                    if proof is not None:
                        response_bytes += len(json_bytes(proof.model_dump(mode="json"))) + (
                            1 if geometry_corrections else 0
                        )
                        geometry_corrections.append(proof.model_dump(mode="json"))
                else:
                    response = accept_attempt_recognition(
                        recognition_task,
                        returned[0],
                        writer,
                        incoming,
                        isinstance(
                            request,
                            (
                                NativeLayoutReconstructionInput,
                                NativeStructureReconstructionInput,
                                NativeWordWrapReconstructionInput,
                            ),
                        ),
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
            source,
            scratch,
            pages,
            _input(
                request, responses, [], native_responses, geometry_corrections=geometry_corrections
            ),
        )
        if isinstance(request, ContinuationReconstructionInput):
            if (
                not isinstance(batch, ContinuationRefinementBatch)
                or batch.source_continuation_policy != request.source_continuation_policy
            ):
                raise ValueError("Continuation batch differs from captured input")
        elif isinstance(batch, ContinuationRefinementBatch):
            raise ValueError("Continuation batch requires its captured input")
        if isinstance(request, FrontmatterTitleReconstructionInput):
            if (
                not isinstance(batch, FrontmatterTitleRefinementBatch)
                or batch.source_title_policy != request.source_title_policy
            ):
                raise ValueError("Complete-title batch differs from captured input")
        elif isinstance(batch, FrontmatterTitleRefinementBatch):
            raise ValueError("Complete-title batch requires its captured input")
        if batch.source_sha256 != request.source_sha256 or len(
            {task.task_id for task in batch.tasks}
        ) != len(batch.tasks):
            raise ValueError("Refinement batch source/task identity differs")
        # Current batches are bounded by atomic private spooling in the writer.
        if not isinstance(request, ContinuationReconstructionInput):
            encode_packet(batch.model_dump(mode="json"), 24 * 1024 * 1024)
        for refinement_task in batch.tasks:
            if (
                refinement_task.source_sha256 != request.source_sha256
                or refinement_task.profile_id != request.profile_id
                or (
                    isinstance(refinement_task, FrontmatterTitleTask)
                    and refinement_task.source_page_count != preparation.count
                )
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
        word_responses: list[Any] = []
        if isinstance(request, NativeWordWrapReconstructionInput):
            word_input = _input(
                request,
                responses,
                refinements,
                native_responses,
                geometry_corrections=geometry_corrections,
            )
            assert isinstance(word_input, NativeWordWrapReconstructionInput)
            word_responses = attempt_word_wrap(
                preparation,
                pages,
                word_input,
                writer,
                incoming,
                response_bytes,
                RECOGNITION_BYTES,
            )
            del word_input
        if incoming.read(1):
            raise ValueError("Attempt received trailing reply bytes")
        complete = _input(
            request, responses, refinements, native_responses, word_responses, geometry_corrections
        )
        del batch, responses, refinements, native_responses, word_responses
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
    writer = ExchangeWriter(
        outgoing,
        request.source_sha256,
        request.profile_id,
        version=2 if isinstance(request, NativeWordWrapReconstructionInput) else 1,
        current_refinement=isinstance(request, ContinuationReconstructionInput),
    )
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
