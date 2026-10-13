"""Pair authority stays original; only checked local coordinates and hashes are derived."""

import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts.layout_hyphen import candidate_digest
from ava_pdf_epub.contracts.layout_normalization import LayoutNormalizationMap
from ava_pdf_epub.reconstruction_v2.layout_hyphen_derivation import derive_layout_hyphen
from ava_pdf_epub.reconstruction_v2.layout_hyphen_normalization import normalize_layout_hyphens

from .layout_hyphen_fixtures import PDF_SHA, authored_hyphens


def derived(disposition="layout", pair="possess-\ning"):
    prefix, suffix = "A😀B é.\n", "\nNext."
    source = prefix + pair + suffix
    candidates, decisions = authored_hyphens(pair, [(0, disposition)])
    result = derive_layout_hyphen(source, pair, candidates[0], decisions[0], len(prefix))
    return source, result


def normalized(source, item, *, candidate=None, disposition=None):
    return normalize_layout_hyphens(
        source,
        PDF_SHA,
        [candidate or item.candidate],
        [disposition or item.disposition],
        derivations=[item.derivation],
    )


class LayoutHyphenDerivationTests(unittest.TestCase):
    def test_original_receipt_and_unicode_source_pair_survive_local_translation(self):
        source, item = derived()
        result = normalized(source, item)
        self.assertEqual("A😀B é.\npossessing\nNext.", result.text)
        self.assertNotEqual(
            item.disposition.candidate_sha256, item.derivation.source_disposition.candidate_sha256
        )
        self.assertEqual(
            candidate_digest(item.derivation.source_candidate),
            item.derivation.source_disposition.candidate_sha256,
        )
        self.assertEqual(item.derivation.source_candidate.left.line_id, item.candidate.left.line_id)
        self.assertEqual(item.derivation.source_candidate.left.box, item.candidate.left.box)
        again = LayoutNormalizationMap.model_validate_json(result.normalization.model_dump_json())
        self.assertEqual(item.derivation, again.derivations[0])
        again.validate_canonical(result.text)

    def test_changed_reading_or_geometry_cannot_be_laundered_as_local_rebinding(self):
        source, item = derived("literal")
        changed = item.disposition.model_copy(update={"disposition": "layout"})
        with self.assertRaisesRegex(ValidationError, "original reading decision"):
            normalized(source, item, disposition=changed)
        box = item.candidate.left.box.model_copy(update={"x0": 11.0})
        candidate = item.candidate.model_copy(
            update={"left": item.candidate.left.model_copy(update={"box": box})}
        )
        disposition = item.disposition.model_copy(
            update={"candidate_sha256": candidate_digest(candidate)}
        )
        with self.assertRaisesRegex(ValidationError, "changed source witnesses"):
            normalized(source, item, candidate=candidate, disposition=disposition)

    def test_replacing_original_provider_digest_with_local_digest_refuses(self):
        source, item = derived()
        result = normalized(source, item)
        raw = result.normalization.model_dump()
        raw["derivations"][0]["source_disposition"]["candidate_sha256"] = (
            item.disposition.candidate_sha256
        )
        with self.assertRaisesRegex(ValidationError, "another candidate"):
            LayoutNormalizationMap.model_validate(raw)
        raw = result.normalization.model_dump()
        raw.pop("derivations")
        with self.assertRaises(ValidationError):
            LayoutNormalizationMap.model_validate(raw)

    def test_marker_cut_or_unbound_offset_refuses_without_affine_source_proof(self):
        pair = "1. possess-\ning"
        candidates, decisions = authored_hyphens(pair, [(0, "layout")])
        for source, offset in (("possess-\ning", 0), (pair, 1), (pair, -1)):
            with self.subTest(source=source, offset=offset), self.assertRaises(ValueError):
                derive_layout_hyphen(source, pair, candidates[0], decisions[0], offset)
