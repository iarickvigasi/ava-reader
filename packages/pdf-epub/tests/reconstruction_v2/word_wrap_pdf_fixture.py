"""A tiny authored PDF exercises real extraction, checkpoint and EPUB boundaries."""

import hashlib

from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject

from ava_pdf_epub.reconstruction_v2.protocol import reconstruction_input
from ava_pdf_epub.reconstruction_v2.word_wrap_contract import WordWrapResponse

from .native_layout_fixture import BODY, document


def wrapped_document(path):
    document(path)
    writer = PdfWriter(clone_from=PdfReader(path))
    for page in writer.pages:
        original = page.get_contents().get_data()
        updated = original.replace(
            BODY[0].encode(),
            b"Several bright readers follow this single stream of informa-",
        ).replace(
            BODY[1].encode(),
            b"tion. A careful paragraph continues along its original measure.",
        )
        stream = DecodedStreamObject()
        stream.set_data(updated)
        page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)
    return path


def input5(source):
    return reconstruction_input(
        dict(
            schema_version="ava-reconstruct-input-5",
            source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
            profile_id="ava-pdf-prose-en-uk-v3",
            source_feature_policy="ava-ocr-source-features-1",
            source_layout_policy="ava-native-layout-1",
            source_structure_policy="ava-native-structure-1",
            source_normalization_policy="ava-native-word-wrap-1",
            responses=[],
            native_structure_responses=[],
            refinements=[],
            word_wrap_responses=[],
        )
    )


def authored_wrap_answers(batch):
    return [
        WordWrapResponse.model_validate(
            dict(
                schema_version="ava-native-word-wrap-response-1",
                task_id=task.task_id,
                source_sha256=task.source_sha256,
                observation_sha256=task.observation_sha256,
                catalogue_sha256=task.catalogue_sha256,
                decisions=[dict(id=entry.id, disposition="layout") for entry in task.entries],
            )
        )
        for task in batch.tasks
    ]
