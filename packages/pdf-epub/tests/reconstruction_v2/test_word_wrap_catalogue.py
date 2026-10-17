"""The whole final source-owner catalogue, not NativeTask presence, decides finite scope."""

import unittest

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.word_wrap_catalogue import prepare_word_wrap_catalogue

from .word_wrap_fixture import SOURCE_SHA256, authored_source


def prepare(owners, pages, **kwargs):
    return prepare_word_wrap_catalogue(
        owners,
        pages,
        source_sha256=SOURCE_SHA256,
        profile_id="ava-pdf-prose-en-v2",
        observation_sha256="c" * 64,
        **kwargs,
    )


class WordWrapCatalogueTests(unittest.TestCase):
    def test_all_supported_final_roles_qualify_without_native_tasks(self):
        for role in ("paragraph", "note", "list_item", "heading", "caption", "credit", "quote"):
            owners, pages, _, _, _ = authored_source([(1, "a trans-"), (1, "formation")], role=role)
            with self.subTest(role=role):
                batch = prepare(owners, pages)
                self.assertEqual(len(batch.entries), 1)
                self.assertEqual(batch.entries[0].candidate.role, role)
                self.assertEqual(batch.census[0].resolution, "request")

    def test_preserved_and_unsupported_endings_survive_zero_task_census(self):
        for role, expected in (
            ("verse", "preserved"),
            ("code", "preserved"),
            ("aside", "unsupported"),
        ):
            owners, pages, _, _, _ = authored_source([(1, "trans-"), (1, "formation-")], role=role)
            batch = prepare(owners, pages)
            with self.subTest(role=role):
                self.assertEqual(batch.tasks, [])
                self.assertEqual(len(batch.census), 2)
                self.assertTrue(all(item.classification == expected for item in batch.census))
        owners, pages, _, _, _ = authored_source([(1, "2-"), (1, "letter-")])
        self.assertEqual(
            [item.reason for item in prepare(owners, pages).census],
            ["not_letter_pair", "no_following_owner_line"],
        )
        self.assertEqual(prepare([], pages).census[0].reason, "no_final_native_owner")

    def test_page_pair_requires_the_same_final_owner_and_ordered_source_pages(self):
        owners, pages, _, _, _ = authored_source([(1, "trans-"), (2, "formation")])
        batch = prepare(owners, pages)
        self.assertEqual(batch.entries[0].candidate.boundary, "page")
        owners, pages, _, _, _ = authored_source([(1, "trans-"), (3, "formation")])
        self.assertEqual(prepare(owners, pages).census[0].reason, "unsupported_boundary")

    def test_repeated_text_uses_explicit_source_offsets_and_original_pair(self):
        owners, pages, _, _, _ = authored_source([(1, "same-"), (1, "same-"), (1, "ending")])
        entries = prepare(owners, pages).entries
        self.assertEqual([entry.original_owner_source_offset for entry in entries], [0, 6])
        self.assertNotEqual(entries[0].candidate.id, entries[1].candidate.id)
        owners[0] = owners[0].model_copy(update={"source_text": "same-\nending\nsame-"})
        with self.assertRaises(ValueError):
            prepare(owners, pages)

    def test_note_prefixes_on_both_lines_retain_full_original_witnesses(self):
        owners, pages, _, _, _ = authored_source(
            [(1, "1. trans-"), (2, "1. formation")],
            role="note",
            prefixes={0: "1. ", 1: "1. "},
        )
        entry = prepare(owners, pages).entries[0]
        self.assertEqual(entry.source_pair, "1. trans-\n1. formation")
        self.assertEqual(entry.context, "trans-\nformation")
        self.assertEqual(entry.left.text_sha256, text_digest("1. trans-"))
        self.assertEqual(len(entry.pair_cuts), 2)
        self.assertEqual(entry.owner_source_offset, 0)
