"""Authored final-owner snapshots exercise sparse assembly without provider calls."""

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.refinement_digest import observation_digest
from ava_pdf_epub.reconstruction_v2.word_wrap_assembly import WordWrapAssembly
from ava_pdf_epub.reconstruction_v2.word_wrap_catalogue import prepare_word_wrap_catalogue
from ava_pdf_epub.reconstruction_v2.word_wrap_contract import WordWrapResponse

from .word_wrap_fixture import SOURCE_SHA256, authored_source


def assembly_case(rows, *, role="paragraph", prefixes=None, disposition="layout", spans=None):
    owners, pages, segment, source_pages, _ = authored_source(
        rows,
        role=role,
        prefixes=prefixes,
    )
    if spans is not None:
        segment = segment.model_copy(update={"spans": spans})
    state = AssemblyState(word_wrap_active=True)
    state.segments[segment.id] = segment
    assembly = WordWrapAssembly(
        [p.model_dump() for p in source_pages],
        [segment],
        state,
        [segment],
        {},
    )
    batch = prepare_word_wrap_catalogue(
        owners,
        pages,
        source_sha256=SOURCE_SHA256,
        profile_id="ava-pdf-prose-en-v2",
        observation_sha256=observation_digest([segment]),
    )
    responses = [
        WordWrapResponse.model_validate(
            dict(
                schema_version="ava-native-word-wrap-response-1",
                task_id=task.task_id,
                source_sha256=task.source_sha256,
                observation_sha256=task.observation_sha256,
                catalogue_sha256=task.catalogue_sha256,
                decisions=[dict(id=entry.id, disposition=disposition) for entry in task.entries],
            )
        )
        for task in batch.tasks
    ]
    return assembly, owners, batch, responses
