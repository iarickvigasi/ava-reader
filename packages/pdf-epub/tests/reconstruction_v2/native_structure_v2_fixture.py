"""Authored source and explicit Native2 decisions, never a provided-book model reply."""

from ava_pdf_epub.contracts.layout_hyphen import LayoutHyphenDisposition, candidate_digest
from ava_pdf_epub.contracts.profiles import LEGACY_PROFILE
from ava_pdf_epub.reconstruction_v2.native_structure_hyphen_candidates import (
    source_hyphen_candidates,
)
from ava_pdf_epub.reconstruction_v2.native_structure_source import prepare_native_structure
from ava_pdf_epub.reconstruction_v2.native_structure_v2_contract import NativeStructureResponse2

from .native_structure_decision_fixture import (
    SOURCE,
    line,
    page,
    region,
    superscript_line,
)


def response2(task, groups, dispositions=(), references=()):
    return NativeStructureResponse2.model_validate(
        dict(
            schema_version="ava-native-structure-response-2",
            task_id=task.task_id,
            source_sha256=task.source_sha256,
            observation_sha256=task.observation_sha256,
            render_sha256=task.image.sha256,
            groups=groups,
            boundary_dispositions=list(dispositions),
            references=list(references),
            unresolved=[],
            language="en",
        )
    )


def native_structure2_source_fixture():
    lines = [
        superscript_line(),
        line("p1-line1", "cription follows.", y=60),
        line("p1-note", "1. A source note.", y=100),
    ]
    observation, image = page(lines)
    regions = [region("body", lines[:2]), region("notes", lines[2:], band=1)]
    candidate = source_hyphen_candidates(observation, regions, SOURCE, LEGACY_PROFILE)[0]
    task = prepare_native_structure(
        observation,
        SOURCE,
        image,
        regions,
        candidates=[candidate],
        structure_policy="ava-native-structure-2",
    )
    answer = response2(
        task,
        [
            dict(
                id="body-one",
                region_id="body",
                kind="paragraph",
                line_ids=[s.id for s in lines[:2]],
                continues_from_previous=False,
                continues_to_next=False,
            ),
            dict(
                id="note-one",
                region_id="notes",
                kind="note",
                line_ids=[lines[2].id],
                note_label="1",
                note_role="footnote",
            ),
        ],
        [
            LayoutHyphenDisposition(
                candidate_id=candidate.id,
                candidate_sha256=candidate_digest(candidate),
                disposition="literal",
            )
        ],
        [dict(span_id=task.eligible_callouts[0].span_id, role="note_callout")],
    )
    return observation, task, answer, candidate


def native_structure2_wire_fixture():
    _, task, answer, _ = native_structure2_source_fixture()
    return task, answer


def initial2():
    return dict(
        schema_version="ava-reconstruct-input-8",
        source_sha256=SOURCE,
        profile_id="ava-pdf-prose-en-uk-v3",
        source_feature_policy="ava-ocr-source-features-1",
        source_layout_policy="ava-native-layout-1",
        source_structure_policy="ava-native-structure-2",
        source_normalization_policy="ava-native-word-wrap-1",
        recognition_repair_policy="ava-recognition-geometry-repair-1",
        source_title_policy="ava-frontmatter-title-1",
        responses=[],
        native_structure_responses=[],
        word_wrap_responses=[],
        geometry_corrections=[],
        refinements=[],
    )
