"""Census completeness and UTF-8 task limits hold for long and multilingual source context."""

import json
import unittest

from ava_pdf_epub.reconstruction_v2.word_wrap_contract import WordWrapBatch
from ava_pdf_epub.reconstruction_v2.word_wrap_identity import word_wrap_public_task

from .test_word_wrap_catalogue import prepare
from .word_wrap_fixture import authored_source, word_wrap_batch


class WordWrapBoundsTests(unittest.TestCase):
    def test_context_keeps_complete_split_word_with_exact_surrounding_slice(self):
        left = "near " * 60 + "trans-"
        right = "formation " + "after " * 60
        owners, pages, _, _, _ = authored_source([(1, left), (1, right)])
        context = prepare(owners, pages).entries[0].context
        self.assertEqual(len(context), 256)
        self.assertIn("trans-\nformation", context)
        self.assertIn(context, left + "\n" + right)

    def test_multibyte_contexts_pack_by_public_bytes_as_well_as_entry_count(self):
        text = ("слово " * 30) + "сло-"
        owners, pages, _, _, _ = authored_source(
            [(1, text) for _ in range(128)] + [(1, "во " + "слово " * 30)],
            language="uk",
        )
        from ava_pdf_epub.reconstruction_v2.word_wrap_catalogue import prepare_word_wrap_catalogue

        batch = prepare_word_wrap_catalogue(
            owners,
            pages,
            source_sha256="a" * 64,
            profile_id="ava-pdf-prose-en-uk-v3",
            observation_sha256="c" * 64,
        )
        self.assertGreater(len(batch.tasks), 1)
        self.assertEqual(sum(len(task.entries) for task in batch.tasks), 128)
        for task in batch.tasks:
            wire = json.dumps(
                word_wrap_public_task(task),
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode()
            self.assertLessEqual(len(wire), 48 * 1024)
            self.assertLessEqual(len(task.entries), 128)

    def test_long_split_word_is_preserved_with_explicit_unsupported_reason(self):
        owners, pages, _, _, _ = authored_source([(1, "a" * 180 + "-"), (1, "b" * 180)])
        batch = prepare(owners, pages)
        self.assertEqual(batch.tasks, [])
        self.assertEqual(batch.census[0].reason, "split_word_exceeds_context")

    def test_whole_catalogue_and_census_hashes_cannot_omit_a_case(self):
        batch = word_wrap_batch(2)
        for field in ("entries", "census", "tasks"):
            raw = batch.model_dump()
            raw[field] = raw[field][1:]
            with self.subTest(field=field), self.assertRaises(ValueError):
                WordWrapBatch.model_validate(raw)

    def test_4097_qualified_entries_refuse_the_finite_32_task_bound(self):
        owners, pages, _, _, _ = authored_source(
            [(1, "form-") for _ in range(4097)] + [(1, "ation")]
        )
        with self.assertRaisesRegex(ValueError, "finite task count"):
            prepare(owners, pages)
