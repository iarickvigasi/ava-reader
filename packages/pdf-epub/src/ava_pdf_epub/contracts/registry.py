"""A single static schema authority for Python and generated JSON Schema consumers."""

from .accepted import AcceptedContentV1
from .book import CanonicalBookV2
from .common import Record
from .job import JobInputV1
from .reader import ReaderPackageV3
from .results import WorkerResultV1

MODELS: dict[str, type[Record]] = {
    "ava-book-2": CanonicalBookV2,
    "ava-pdf-job-1": JobInputV1,
    "ava-pdf-worker-result-1": WorkerResultV1,
    "ava-accepted-content-1": AcceptedContentV1,
    "ava-reader-3": ReaderPackageV3,
}


def validate_contract(schema_version: str, payload: object) -> Record:
    if schema_version not in MODELS or not isinstance(payload, dict):
        raise ValueError("Unknown contract version or non-object payload")
    if payload.get("schema_version") != schema_version:
        raise ValueError("Missing or mismatched contract schema version")
    return MODELS[schema_version].model_validate(payload)
