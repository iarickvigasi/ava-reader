"""Authored PDF and fixed lexical answers for the worker's sparse attempt transport."""

import hashlib

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes


def source_pdf(root):
    writer = PdfWriter()
    writer.add_metadata({"/Title": "Authored Wrap Source", "/Author": "AVA Fixture Studio"})
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Times-Roman"),
        }
    )
    page = writer.add_blank_page(width=400, height=600)
    page[NameObject("/Resources")] = DictionaryObject(
        {
            NameObject("/Font"): DictionaryObject(
                {
                    NameObject("/F1"): writer._add_object(font),
                }
            )
        }
    )
    rows = [
        "The source readers preserve every native observation.",
        "We are trans-",
        "forming stable proof.",
        "Each ending has the context and source.",
        "True long-",
        "term compounds keep their printed mark.",
    ]
    content = DecodedStreamObject()
    content.set_data(
        "\n".join(
            f"BT /F1 10.5 Tf 36 {500 - index * 14} Td ({text}) Tj ET"
            for index, text in enumerate(rows)
        ).encode()
    )
    page[NameObject("/Contents")] = writer._add_object(content)
    source = root / "word-wrap.pdf"
    writer.write(source)
    return source


def initial(source_sha256="a" * 64):
    return dict(
        schema_version="ava-reconstruct-input-5",
        source_sha256=source_sha256,
        profile_id="ava-pdf-prose-en-v2",
        source_feature_policy="ava-ocr-source-features-1",
        source_layout_policy="ava-native-layout-1",
        source_structure_policy="ava-native-structure-1",
        source_normalization_policy="ava-native-word-wrap-1",
        responses=[],
        native_structure_responses=[],
        refinements=[],
        word_wrap_responses=[],
    )


def request(source):
    return json_bytes(
        dict(mode="attempt_stream", input=initial(hashlib.sha256(source.read_bytes()).hexdigest()))
    )


def answer(task, disposition=None):
    return dict(
        schema_version="ava-native-word-wrap-response-1",
        task_id=task["task_id"],
        catalogue_sha256=task["catalogue_sha256"],
        observation_sha256=task["observation_sha256"],
        source_sha256=task["source_sha256"],
        decisions=[
            dict(
                id=entry["id"],
                disposition=disposition
                or ("layout" if "trans-\nforming" in entry["context"] else "literal"),
            )
            for entry in task["entries"]
        ],
    )
