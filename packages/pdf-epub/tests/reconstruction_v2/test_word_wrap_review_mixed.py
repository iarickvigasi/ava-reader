"""Independent mixed-owner review checks complete projection and immutable OCR receipts."""

import unittest

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.source_feature_binding import bind_source_features
from ava_pdf_epub.reconstruction_v2.word_wrap_apply import apply_word_wrap
from ava_pdf_epub.reconstruction_v2.word_wrap_contract import WordWrapResponse
from ava_pdf_epub.reconstruction_v2.word_wrap_projections import project_word_wrap_positions

from .test_word_wrap_mixed_components import mixed_catalogue
from .word_wrap_mixed_fixture import mixed_case
from .word_wrap_stream_fixture import answer


def normalize_mixed(native_first):
    assembly, observations, pages, cuts, recognized = mixed_case(native_first)
    owners, batch = mixed_catalogue(assembly, observations, pages, cuts)
    responses = [
        WordWrapResponse.model_validate(answer(task.model_dump(mode="json"), "layout"))
        for task in batch.tasks
    ]
    changes = apply_word_wrap(assembly, owners, batch, responses)
    return assembly, recognized, changes


class WordWrapReviewMixedTests(unittest.TestCase):
    def test_actual_alias_projection_then_feature_binding_preserves_both_ocr_directions(self):
        for native_first in (True, False):
            with self.subTest(native_first=native_first):
                assembly, recognized, changes = normalize_mixed(native_first)
                state = assembly.state
                original = dict(
                    node_id=recognized.id,
                    text_length=len(recognized.text),
                    text_sha256=text_digest(recognized.text),
                )
                state.source_feature_evidence = [dict(original)]
                raw_offset = state.aliases[recognized.id][1] if native_first else 0
                project_word_wrap_positions(assembly, changes)
                bind_source_features(state)
                evidence = state.source_feature_evidence[0]
                start = evidence["canonical_start"]
                self.assertEqual(start, raw_offset - (2 if native_first else 0))
                self.assertEqual(evidence["canonical_block_id"], assembly.segments[0].id)
                retained = assembly.segments[0].text[start : start + evidence["text_length"]]
                self.assertEqual(retained, recognized.text)
                self.assertEqual(text_digest(retained), original["text_sha256"])
                self.assertEqual({key: evidence[key] for key in original}, original)

    def test_foreign_or_normalized_ocr_witness_refuses_before_alias_mutation(self):
        for changed_witness in (False, True):
            with self.subTest(changed_witness=changed_witness):
                assembly, recognized, changes = normalize_mixed(True)
                state, owner = assembly.state, assembly.segments[0]
                aliases = dict(state.aliases)
                if changed_witness:
                    original = changes[owner.id][1]
                    evidence = dict(
                        node_id=owner.id,
                        text_length=len(original),
                        text_sha256=text_digest(original),
                    )
                    reason = "changed an OCR appearance witness"
                else:
                    evidence = dict(
                        node_id=recognized.id,
                        text_length=len(recognized.text),
                        text_sha256="f" * 64,
                    )
                    reason = "original source range differs"
                state.source_feature_evidence = [evidence]
                with self.assertRaisesRegex(ValueError, reason):
                    project_word_wrap_positions(assembly, changes)
                self.assertEqual(state.aliases, aliases)
                self.assertEqual(state.source_feature_evidence[0], evidence)


if __name__ == "__main__":
    unittest.main()
