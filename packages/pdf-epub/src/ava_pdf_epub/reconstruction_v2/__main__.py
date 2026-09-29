"""Fixed sandbox entry: no caller paths, provider credentials or network access."""

import json
import sys
from pathlib import Path

from ..contracts.common import document_digest
from ..contracts.private_files import snapshot
from .prepare_page import prepare_page
from .prepare_refinement_source import prepare_refinement_source
from .protocol import PrepareResult, ReconstructionInput
from .protocol_output import candidate_packet, encode_packet
from .reconstruct_source import reconstruct_source
from .stream_output import stream_artifacts
from .validate_refinement import validate_refinement
from .validate_tasks import validate_tasks


def main() -> None:
    try:
        root = Path("/scratch")
        root.mkdir(exist_ok=True)
        raw_request = snapshot(Path("/input"), "reconstruction-request.json", 64 * 1024 * 1024)
        request = json.loads(raw_request)
        if request.get("mode") in {"validate_tasks", "validate_refinement"}:
            receipt = (
                validate_tasks(raw_request).model_dump(mode="json")
                if request["mode"] == "validate_tasks"
                else validate_refinement(raw_request)
            )
            sys.stdout.buffer.write(encode_packet(receipt, 1024))
            sys.stdout.buffer.flush()
            return
        source = root / "source.pdf"
        source.write_bytes(snapshot(Path("/input"), "source.pdf", 52428800))
        if request.get("mode") == "prepare" and set(request) == {"mode", "page_number"}:
            if type(request["page_number"]) is not int:
                raise ValueError("Invalid page number")
            prepared = prepare_page(source, root, request["page_number"])
            result = PrepareResult(
                schema_version="ava-prepare-result-1",
                source_sha256=prepared.source_sha256,
                source_page_count=prepared.source_page_count,
                page_number=prepared.observation.number,
                observation_sha256=document_digest(prepared.observation),
                native_segment_count=len(prepared.native_segments),
                tasks=prepared.tasks,
            )
            output = encode_packet(result.model_dump(mode="json"), 8 * 1024 * 1024)
        elif request.get("mode") == "prepare_refinement" and set(request) == {"mode", "input"}:
            parsed = ReconstructionInput.model_validate(request["input"])
            batch = prepare_refinement_source(source, root, parsed)
            output = encode_packet(batch.model_dump(mode="json"), 24 * 1024 * 1024)
        elif request.get("mode") in {"reconstruct", "reconstruct_stream"} and set(request) == {
            "mode",
            "input",
        }:
            parsed = ReconstructionInput.model_validate(request["input"])
            book, report = reconstruct_source(source, root, parsed)
            if request["mode"] == "reconstruct_stream":
                for record in stream_artifacts(book, report):
                    sys.stdout.buffer.write(record)
                    sys.stdout.buffer.flush()
                return
            output = encode_packet(candidate_packet(book, report), 64 * 1024 * 1024)
        else:
            raise ValueError("Unknown reconstruction command")
        sys.stdout.buffer.write(output)
        sys.stdout.buffer.flush()
    except Exception:
        print(
            json.dumps(
                {
                    "schema_version": "ava-reconstruction-error-1",
                    "code": "RECONSTRUCTION_REVIEW_REQUIRED",
                }
            ),
            flush=True,
        )
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
