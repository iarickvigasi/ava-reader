"""A native chapter followed by an OCR rank that requires book-wide source review."""

import hashlib

from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.protocol import ReconstructionInput

from .mixed_heading_fixtures import recognition, source_pdf


def provisional_case(root, level=3):
    source = source_pdf(root)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    pages = prepare_source(source, root / "pages", digest)
    response = recognition(pages[1].tasks[0])
    response = response.model_copy(
        update={
            "segments": [
                s.model_copy(update={"heading_level": level}) if s.kind == "heading" else s
                for s in response.segments
            ]
        }
    )
    request = ReconstructionInput(
        schema_version="ava-reconstruct-input-1", source_sha256=digest, responses=[response]
    )
    return source, pages, request
