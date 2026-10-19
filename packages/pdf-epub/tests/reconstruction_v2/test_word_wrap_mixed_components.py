"""Mixed provenance preserves local native wraps and never classifies recognized source gaps."""

import unittest

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.refinement_digest import observation_digest
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins
from ava_pdf_epub.reconstruction_v2.word_wrap_apply import apply_word_wrap
from ava_pdf_epub.reconstruction_v2.word_wrap_catalogue import prepare_word_wrap_catalogue
from ava_pdf_epub.reconstruction_v2.word_wrap_contract import WordWrapResponse
from ava_pdf_epub.reconstruction_v2.word_wrap_feature_ranges import verify_word_wrap_feature_ranges
from ava_pdf_epub.reconstruction_v2.word_wrap_owners import catalogue_owners

from .word_wrap_fixture import SOURCE_SHA256, authored_source
from .word_wrap_mixed_fixture import mixed_case
from .word_wrap_stream_fixture import answer


def mixed_catalogue(assembly, observations, source_pages, cuts):
    owners = catalogue_owners(
        assembly.segments,
        observations,
        source_pages,
        cuts,
        "en",
        components=assembly.size_sources,
        aliases=assembly.state.aliases,
    )
    batch = prepare_word_wrap_catalogue(
        owners,
        observations,
        source_sha256=SOURCE_SHA256,
        profile_id="ava-pdf-prose-en-v2",
        observation_sha256=observation_digest(assembly.segments),
    )
    return owners, batch


class WordWrapMixedComponentsTests(unittest.TestCase):
    def test_both_mixed_directions_keep_native_pair_and_protected_ocr_feature_text(self):
        for native_first in (True, False):
            with self.subTest(native_first=native_first):
                assembly, observations, source_pages, cuts, recognized = mixed_case(native_first)
                owners, batch = mixed_catalogue(assembly, observations, source_pages, cuts)
                self.assertEqual(len(batch.entries), 1)
                self.assertEqual(
                    batch.entries[0].source_pair, "The source trans-\nforming remains exact."
                )
                self.assertEqual(
                    [part.method for part in owners[0].components],
                    ["native", "ocr"] if native_first else ["ocr", "native"],
                )
                expected_start = 0 if native_first else len(recognized.source_text) + 1
                self.assertEqual(owners[0].lines[0].source_start, expected_start)
                assembly.state.source_feature_evidence = [
                    dict(
                        node_id=recognized.id,
                        text_length=len(recognized.text),
                        text_sha256=text_digest(recognized.text),
                    )
                ]
                responses = [
                    WordWrapResponse.model_validate(answer(task.model_dump(mode="json"), "layout"))
                    for task in batch.tasks
                ]
                changes = apply_word_wrap(assembly, owners, batch, responses)
                verify_word_wrap_feature_ranges(assembly.state, changes)
                self.assertIn("The source transforming remains exact.", assembly.segments[0].text)
                self.assertIn(recognized.text, assembly.segments[0].text)

    def test_missing_component_authority_or_changed_ocr_source_and_alias_refuse(self):
        for native_first in (True, False):
            assembly, observations, source_pages, cuts, _ = mixed_case(native_first)
            with self.subTest(native_first=native_first), self.assertRaises(ValueError):
                catalogue_owners(assembly.segments, observations, source_pages, cuts, "en")
            pieces = [
                piece.model_copy(update={"source_text": "Changed recognized source."})
                if piece.method == "ocr"
                else piece
                for piece in assembly.size_sources
            ]
            with self.assertRaisesRegex(ValueError, "source components differ"):
                catalogue_owners(
                    assembly.segments,
                    observations,
                    source_pages,
                    cuts,
                    "en",
                    components=pieces,
                    aliases=assembly.state.aliases,
                )
            child = assembly.size_sources[1]
            target, at = assembly.state.aliases[child.id]
            with self.assertRaisesRegex(ValueError, "text/offset"):
                catalogue_owners(
                    assembly.segments,
                    observations,
                    source_pages,
                    cuts,
                    "en",
                    components=assembly.size_sources,
                    aliases={child.id: (target, at + 1)},
                )

    def test_native_lines_across_protected_ocr_gap_remain_explicitly_unsupported(self):
        _, observations, original, source_pages, cuts = authored_source(
            [(1, "native-"), (3, "continuation")]
        )
        first = original.model_copy(
            update={
                "id": "native-first",
                "text": "native-",
                "source_text": "native-",
                "native_line_ids": original.native_line_ids[:1],
                "continues_to_next": True,
            }
        )
        middle = original.model_copy(
            update={
                "id": "recognized-middle",
                "page": 2,
                "method": "ocr",
                "native_line_ids": [],
                "text": "Protected OCR.",
                "source_text": "Protected OCR.",
                "continues_from_previous": True,
                "continues_to_next": True,
            }
        )
        last = original.model_copy(
            update={
                "id": "native-last",
                "page": 3,
                "text": "continuation",
                "source_text": "continuation",
                "native_line_ids": original.native_line_ids[1:],
                "continues_from_previous": True,
            }
        )
        parts = [first, middle, last]
        state = AssemblyState()
        for part in parts:
            state.evidence[part.id] = [dict(page=part.page)]
            state.placements[part.id] = (part.page, 0, 0)
        joined = stream_joins(parts, state)
        owners = catalogue_owners(
            joined, observations, source_pages, cuts, "en", components=parts, aliases=state.aliases
        )
        batch = prepare_word_wrap_catalogue(
            owners,
            observations,
            source_sha256=SOURCE_SHA256,
            profile_id="ava-pdf-prose-en-v2",
            observation_sha256="c" * 64,
        )
        self.assertEqual(batch.tasks, [])
        self.assertEqual(batch.census[0].reason, "unsupported_boundary")
        self.assertEqual(joined[0].text, "native- Protected OCR. continuation")

    def test_adjacent_native_components_still_qualify_the_exact_cross_page_pair(self):
        _, observations, original, source_pages, cuts = authored_source(
            [(1, "trans-"), (2, "forming")]
        )
        parts = [
            original.model_copy(
                update={
                    "id": f"native-component{index}",
                    "page": index + 1,
                    "text": text,
                    "source_text": text,
                    "native_line_ids": [original.native_line_ids[index]],
                    "continues_from_previous": index > 0,
                    "continues_to_next": index == 0,
                }
            )
            for index, text in enumerate(("trans-", "forming"))
        ]
        state = AssemblyState()
        for part in parts:
            state.evidence[part.id] = [dict(page=part.page)]
            state.placements[part.id] = (part.page, 0, 0)
        joined = stream_joins(parts, state)
        owners = catalogue_owners(
            joined, observations, source_pages, cuts, "en", components=parts, aliases=state.aliases
        )
        batch = prepare_word_wrap_catalogue(
            owners,
            observations,
            source_sha256=SOURCE_SHA256,
            profile_id="ava-pdf-prose-en-v2",
            observation_sha256="c" * 64,
        )
        self.assertEqual(len(batch.entries), 1)
        self.assertEqual(batch.entries[0].candidate.boundary, "page")
        self.assertEqual(batch.entries[0].source_pair, "trans-\nforming")
