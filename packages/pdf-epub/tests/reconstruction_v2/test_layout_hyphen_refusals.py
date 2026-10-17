"""Undeclared, stale, foreign and ambiguous transformations fail closed."""

import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts.layout_hyphen import LayoutHyphenCandidate, candidate_digest
from ava_pdf_epub.contracts.normalization import NormalizationMap
from ava_pdf_epub.reconstruction_v2.layout_hyphen_normalization import normalize_layout_hyphens

from .layout_hyphen_fixtures import PDF_SHA, authored_hyphens


class LayoutHyphenRefusalTests(unittest.TestCase):
    def test_missing_duplicate_and_foreign_dispositions_refuse(self):
        source = "possess-\ning"
        candidates, decisions = authored_hyphens(source, [(0, "layout")])
        for supplied in (
            [],
            decisions * 2,
            [decisions[0].model_copy(update={"candidate_id": "another"})],
            [decisions[0].model_copy(update={"candidate_sha256": "b" * 64})],
        ):
            with self.subTest(supplied=supplied), self.assertRaises(ValueError):
                normalize_layout_hyphens(source, PDF_SHA, candidates, supplied)
        with self.assertRaisesRegex(ValueError, "another source"):
            normalize_layout_hyphens(source, "b" * 64, candidates, decisions)
        with self.assertRaisesRegex(ValueError, "literal observation"):
            normalize_layout_hyphens(source + "!", PDF_SHA, candidates, decisions)

    def test_ambiguous_reading_requires_a_new_source_grounded_decision(self):
        source = "re-\ncover"
        candidates, decisions = authored_hyphens(source, [(0, "unresolved")])
        with self.assertRaisesRegex(ValueError, "Unresolved"):
            normalize_layout_hyphens(source, PDF_SHA, candidates, decisions)
        self.assertEqual(source, normalize_layout_hyphens(source, PDF_SHA, [], []).text)

    def test_literal_modes_and_paragraph_transitions_are_ineligible(self):
        candidates, _ = authored_hyphens("possess-\ning", [(0, "layout")])
        for change in (
            {"role": "code"},
            {"role": "verse"},
            {"preserve_line_breaks": True},
            {"consecutive": False},
        ):
            with self.subTest(change=change), self.assertRaises(ValidationError):
                LayoutHyphenCandidate.model_validate(
                    candidates[0].model_copy(update=change).model_dump()
                )

    def test_inline_hyphen_and_changed_letters_cannot_be_named_layout(self):
        source = "possess-\ning gym-lovers"
        candidates, decisions = authored_hyphens(source, [(0, "layout")])
        candidate = candidates[0].model_copy(update={"source_start": 5})
        decision = decisions[0].model_copy(update={"candidate_sha256": candidate_digest(candidate)})
        with self.assertRaisesRegex(ValueError, "named hyphen"):
            normalize_layout_hyphens(source, PDF_SHA, [candidate], [decision])
        with self.assertRaisesRegex(ValueError, "explicit base map"):
            normalize_layout_hyphens(source, PDF_SHA, candidates, decisions, text="possessing")

    def test_historical_map_rejects_new_authority_and_new_kind(self):
        candidates, decisions = authored_hyphens("possess-\ning", [(0, "layout")])
        result = normalize_layout_hyphens("possess-\ning", PDF_SHA, candidates, decisions)
        with self.assertRaises(ValidationError):
            NormalizationMap.model_validate(result.normalization.model_dump())
        raw = result.normalization.model_dump(
            exclude={
                "schema_version",
                "source_pdf_sha256",
                "candidates",
                "dispositions",
                "derivations",
            }
        )
        for item in raw["segments"]:
            item.pop("candidate_id", None)
        with self.assertRaises(ValidationError):
            NormalizationMap.model_validate(raw)

    def test_tampered_map_cannot_change_a_letter_or_remove_literal_hyphen(self):
        source = "well-\nknown"
        candidates, decisions = authored_hyphens(source, [(0, "literal")])
        result = normalize_layout_hyphens(source, PDF_SHA, candidates, decisions)
        with self.assertRaisesRegex(ValueError, "does not produce"):
            result.normalization.validate_canonical("well-knawn")
        changed = result.normalization.model_copy(
            update={
                "segments": [
                    s.model_copy(update={"kind": "layout_hyphen"}) if s.candidate_id else s
                    for s in result.normalization.segments
                ]
            }
        )
        with self.assertRaisesRegex(ValueError, "differs from"):
            changed.validate_canonical(result.text)
