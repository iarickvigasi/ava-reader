"""Fixed sandbox entry: no caller paths, provider credentials or network access."""

import json
import sys
from pathlib import Path

from ..contracts.private_files import snapshot
from ..contracts.profiles import LEGACY_PROFILE, checked_profile
from ..worker_observation import Observation, observe, phase
from .prepare_page import prepare_page
from .prepare_refinement_source import prepare_refinement_source
from .protocol import ReconstructionInput, prepared_result
from .protocol_output import candidate_packet, encode_packet
from .reconstruct_source import reconstruct_source
from .source_refusal import SourceContentRefusal
from .stream_output import stream_artifacts
from .validate_refinement import validate_refinement
from .validate_tasks import validate_tasks


def main() -> None:
    try:
        observation: Observation | None = Observation(Path("/scratch"))
    except Exception:
        observation = None  # Optional initial sampling cannot bypass the original command.
    try:
        root = Path("/scratch")
        root.mkdir(exist_ok=True)
        raw_request = snapshot(Path("/input"), "reconstruction-request.json", 64 * 1024 * 1024)
        request = json.loads(raw_request)
        if observation is not None:
            observation.start(raw_request, request)
        if request.get("mode") in {"validate_tasks", "validate_refinement"}:
            receipt = (
                validate_tasks(raw_request).model_dump(mode="json")
                if request["mode"] == "validate_tasks"
                else validate_refinement(raw_request)
            )
            sys.stdout.buffer.write(encode_packet(receipt, 1024))
            sys.stdout.buffer.flush()
            return
        # The host owns this fixed private file for the attempt. Parse the read-only
        # input mount instead of creating another writable source copy in scratch.
        source = Path("/input/source.pdf")
        source_bytes = snapshot(Path("/input"), "source.pdf", 52428800)
        observe("source_bytes", source_bytes)
        del source_bytes
        if request.get("mode") == "prepare" and set(request) in (
            {"mode", "page_number"},
            {"mode", "page_number", "profile_id"},
        ):
            if type(request["page_number"]) is not int:
                raise ValueError("Invalid page number")
            with phase("prepare_source"):
                prepared = prepare_page(
                    source,
                    root,
                    request["page_number"],
                    checked_profile(request.get("profile_id", LEGACY_PROFILE)),
                )
            result = prepared_result(prepared)
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
    except SourceContentRefusal as error:
        if observation is not None:
            observation.failed(error)
        print(error.diagnostic.model_dump_json(), flush=True)
        raise SystemExit(1) from None
    except Exception as error:
        if observation is not None:
            observation.failed(error)
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
    finally:
        if observation is not None:
            observation.finish()


if __name__ == "__main__":
    main()
