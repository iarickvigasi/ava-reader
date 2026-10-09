"""Content-free worker identity, safe failure projections and one bounded stderr record."""

import hashlib
import json
from typing import Literal

from .admission_actions import AdmissionError
from .contracts.common import Digest, Id, Record
from .contracts.job import JobInputV1
from .reconstruction_v2.source_refusal import SourceContentRefusal

PREFIX = "AVA_WORKER_OBSERVATION_V1 "
PACKET_BYTES = 6144
COMMANDS = {"prepare", "prepare_refinement", "reconstruct", "reconstruct_stream",
            "validate_tasks", "validate_refinement"}
SAFE_ADMISSION_CODES = {
    "PDF_ACTIVE_CONTENT_UNSUPPORTED", "PDF_EMBEDDED_CONTENT_UNSUPPORTED", "PDF_FORMS_UNSUPPORTED",
    "PDF_ANNOTATION_INVALID", "PDF_RESOURCE_LIMIT", "PDF_REDACTION_UNSUPPORTED",
    "PDF_ANNOTATIONS_UNSUPPORTED", "PDF_ANNOTATION_GEOMETRY_INVALID",
    "PDF_ANNOTATION_APPEARANCE_REQUIRED", "PDF_ANNOTATION_APPEARANCE_INVALID",
    "PDF_ANNOTATION_VISIBILITY_REQUIRES_REVIEW",
}
RELATIONSHIPS = {"/Popup", "/Parent", "/IRT"}


class TrustedUnit(Record):
    schema_version: Literal["ava-worker-observation-binding-1"]
    job_id: Id
    attempt_id: Id
    unit_id: Id


def binding(job: JobInputV1, unit: TrustedUnit, request: bytes) -> dict[str, object]:
    fields = ("operation_id", "profile_id", "config_sha256", "worker_fingerprint", "generation",
              "attempt_fence", "cancellation_epoch")
    return {**{name: getattr(job, name) for name in fields},
            **unit.model_dump(exclude={"schema_version"}), "source_sha256": job.source.sha256,
            "request_sha256": hashlib.sha256(request).hexdigest()}


def failure(error: BaseException, source_sha256: Digest) -> tuple[str, list[dict[str, object]], bool]:
    if isinstance(error, SourceContentRefusal) and error.diagnostic.source_sha256 == source_sha256:
        return (error.diagnostic.findings[0].code,
                [{"kind": "source", **finding.model_dump(mode="json")}
                 for finding in error.diagnostic.findings[:2]],
                len(error.diagnostic.findings) <= 2)
    if isinstance(error, AdmissionError) and str(error) in SAFE_ADMISSION_CODES:
        raw = error.finding or {}
        page, number, path = raw.get("page_number"), raw.get("annotation_number"), raw.get(
            "relationship_path", []
        )
        complete = (type(page) is int and 1 <= page <= 500 and type(number) is int
                    and 1 <= number <= 1000 and isinstance(path, list) and len(path) <= 20
                    and all(type(item) is str and item in RELATIONSHIPS for item in path))
        return str(error), [dict(kind="admission", code=str(error),
                                 page=page if type(page) is int and 1 <= page <= 500 else None,
                                 annotation_number=number if type(number) is int and
                                 1 <= number <= 1000 else None,
                                 relationship_path=path if complete else [])], complete
    return "RECONSTRUCTION_REVIEW_REQUIRED", [], True


def encode(packet: dict[str, object]) -> bytes | None:
    # A large safe finding may reduce diagnostic coverage; never truncate JSON or source values.
    for _ in range(4):
        data = ("\n" + PREFIX + json.dumps(packet, ensure_ascii=True, separators=(",", ":"),
                                    allow_nan=False) + "\n").encode()
        if len(data) <= PACKET_BYTES:
            return data
        findings = packet["findings"]
        if isinstance(findings, list) and findings:
            findings.pop()
            packet["findings_complete"] = False
        else:
            inventory = packet["inventory"]
            if isinstance(inventory, dict):
                inventory["locations"] = []
                inventory["locations_complete"] = False
    return None
