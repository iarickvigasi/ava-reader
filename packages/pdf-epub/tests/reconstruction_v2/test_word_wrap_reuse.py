"""Previously captured native authority survives only exact unchanged source/role bindings."""

import unittest

from ava_pdf_epub.contracts.layout_hyphen import LayoutHyphenCandidate, candidate_digest
from ava_pdf_epub.contracts.layout_hyphen_classification_v3 import (
    NativeStructureHyphenClassificationReceipt,
)

from .test_word_wrap_catalogue import prepare
from .word_wrap_fixture import authored_source


def prior(entry):
    raw = entry.candidate.model_dump()
    raw["schema_version"] = "ava-layout-hyphen-candidate-1"
    candidate = LayoutHyphenCandidate.model_validate(raw)
    return NativeStructureHyphenClassificationReceipt(
        authority="native_structure",
        task_id="captured-native-task",
        task_sha256="d" * 64,
        response_sha256="e" * 64,
        candidate_id=candidate.id,
        source_candidate_sha256=candidate_digest(candidate),
        decision="literal",
        original_candidate=candidate,
    )


class WordWrapReuseTests(unittest.TestCase):
    def test_exact_native_decision_is_in_catalogue_and_census_without_new_task(self):
        owners, pages, _, _, _ = authored_source([(1, "long-"), (1, "term")])
        old = prior(prepare(owners, pages).entries[0])
        batch = prepare(owners, pages, prior_authorities=[old])
        self.assertEqual(batch.tasks, [])
        self.assertEqual(len(batch.entries), 1)
        self.assertEqual(batch.census[0].resolution, "reuse")
        self.assertEqual(batch.entries[0].reused_authority, old)

    def test_changed_final_role_and_marker_cut_request_fresh_source_comparison(self):
        owners, pages, _, _, _ = authored_source([(1, "trans-"), (1, "formation")])
        old = prior(prepare(owners, pages).entries[0])
        owners[0] = owners[0].model_copy(update={"role": "quote"})
        self.assertEqual(len(prepare(owners, pages, prior_authorities=[old]).tasks), 1)
        owners, pages, _, _, _ = authored_source(
            [(1, "1. trans-"), (1, "formation")],
            role="note",
            prefixes={0: "1. "},
        )
        old = prior(prepare(owners, pages).entries[0])
        self.assertEqual(len(prepare(owners, pages, prior_authorities=[old]).tasks), 1)

    def test_changed_native_echo_digest_and_repeated_authority_refuse(self):
        owners, pages, _, _, _ = authored_source([(1, "long-"), (1, "term")])
        old = prior(prepare(owners, pages).entries[0])
        with self.assertRaisesRegex(ValueError, "digest differs"):
            prepare(
                owners,
                pages,
                prior_authorities=[old.model_copy(update={"source_candidate_sha256": "f" * 64})],
            )
        with self.assertRaisesRegex(ValueError, "repeated native"):
            prepare(owners, pages, prior_authorities=[old, old])

    def test_known_unresolved_native_authority_refuses_before_another_sparse_task(self):
        owners, pages, _, _, _ = authored_source(
            [(1, "long-"), (1, "term"), (1, "trans-"), (1, "forming")]
        )
        old = prior(prepare(owners, pages).entries[0]).model_copy(update={"decision": "unresolved"})
        with self.assertRaisesRegex(ValueError, "remains unresolved"):
            prepare(owners, pages, prior_authorities=[old])
