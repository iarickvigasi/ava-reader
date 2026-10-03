"""Lossless canonical envelope; all capabilities still require a qualified renderer."""

from ..contracts.book import CanonicalBookV2
from ..contracts.capabilities import required_capabilities
from ..contracts.common import document_digest
from ..contracts.reader import ReaderPackageV3


def prepare_reader(book: CanonicalBookV2, final_content_id: str) -> ReaderPackageV3:
    book = CanonicalBookV2.model_validate(book.model_dump())
    return ReaderPackageV3.model_validate(
        {
            "schema_version": "ava-reader-3",
            "version": 3,
            "final_content_id": final_content_id,
            "canonical_hash_algorithm": "ava-json-v1",
            "canonical_sha256": document_digest(book),
            "required_capabilities": sorted(required_capabilities(book)),
            "book": book.model_dump(),
        }
    )
