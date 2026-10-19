"""Recover only complete witnessed glyph substitutions; strict glyph matching stays strict."""

import unittest

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.ocr_glyph_map import prove_glyph_map
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan
from ava_pdf_epub.reconstruction_v2.source_quote_recovery import source_quote_recovery

from .source_quote_fixture import quoted


class SourceQuoteRecoveryTests(unittest.TestCase):
    def test_exact_geometry_recovers_apostrophe_and_retains_unicode_offsets_and_styles(self):
        page, owner = quoted()
        owner = owner.model_copy(
            update={
                "spans": [ObservedSpan(start=2, end=7, style=Style(id="emphasis", italic=True))]
            }
        )
        original_page, original_owner = page.model_dump(), owner.model_dump()
        self.assertIsNone(prove_glyph_map(page, owner, [owner], POLICY))
        recovered = source_quote_recovery(page, owner, [owner], POLICY)
        self.assertIsNotNone(recovered)
        candidate, changes = recovered
        self.assertEqual("😀 we’re", candidate.text)
        self.assertEqual([(4, 0, 4, "'", "’")], changes)
        self.assertIsNotNone(prove_glyph_map(page, candidate, [candidate], POLICY))
        self.assertEqual(owner.spans, candidate.spans)
        self.assertEqual(owner.model_dump(exclude={"text"}), candidate.model_dump(exclude={"text"}))
        self.assertEqual(original_page, page.model_dump())
        self.assertEqual(original_owner, owner.model_dump())

    def test_whitespace_stays_exact_and_no_word_or_other_punctuation_can_change(self):
        page, owner = quoted()
        item = owner.model_copy(update={"text": "😀\n  we're\t"})
        recovered = source_quote_recovery(page, item, [item], POLICY)
        self.assertEqual("😀\n  we’re\t", recovered[0].text)
        for text in ("😀 we're!", "😀 WE're", "😀 we'xe", "😀 we’re", "😀 were"):
            item = owner.model_copy(update={"text": text})
            with self.subTest(text=text):
                self.assertIsNone(source_quote_recovery(page, item, [item], POLICY))

    def test_reference_span_cannot_borrow_recovered_punctuation(self):
        page, owner = quoted()
        for destination in (
            {"url": "https://example.com"},
            {"target_text": "we're"},
            {"note_label": "1"},
        ):
            item = owner.model_copy(update={"spans": [ObservedSpan(start=2, end=7, **destination)]})
            self.assertIsNone(source_quote_recovery(page, item, [item], POLICY))

    def test_untrusted_source_or_ambiguous_ownership_never_repairs(self):
        page, owner = quoted()
        hidden = page.lines[0].model_copy(
            update={
                "glyphs": [g.model_copy(update={"visible": False}) for g in page.lines[0].glyphs]
            }
        )
        for current, owners, policy in (
            (page, [owner], None),
            (page, [owner], "unknown"),
            (page.model_copy(update={"risks": ["unreliable_glyph_mapping"]}), [owner], POLICY),
            (page.model_copy(update={"lines": [hidden]}), [owner], POLICY),
            (page, [owner, owner.model_copy(update={"id": "overlap"})], POLICY),
        ):
            self.assertIsNone(source_quote_recovery(current, owner, owners, policy))
        for values in (
            {"method": "native"},
            {"kind": "code"},
            {"source_text": owner.text},
            {"native_line_ids": ["quoted"]},
        ):
            item = owner.model_copy(update=values)
            self.assertIsNone(source_quote_recovery(page, item, [item], POLICY))
