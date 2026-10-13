"""New title receipts retain explicit authority without widening historical aggregates."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from ava_pdf_epub.reconstruction_v2.attempt_complete_input import attempt_complete_input
from ava_pdf_epub.reconstruction_v2.attempt_initial_input import initial_input
from ava_pdf_epub.reconstruction_v2.protocol import reconstruction_input
from ava_pdf_epub.reconstruction_v2.protocol_frontmatter_title import (
    FrontmatterTitleReconstructionInput,
    FrontmatterTitleRefinementBatch,
)
from ava_pdf_epub.reconstruction_v2.word_wrap_reconstruct import reconstruct_word_wrap_assembly

from .frontmatter_title_fixture import frontmatter_fixture, frontmatter_response
from .printed_title_fixture import title_fixture, title_response


class FrontmatterProtocolTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.scratch = Path(directory.name)
        self.task, self.pages, _, _ = frontmatter_fixture(self.scratch)
        self.response = frontmatter_response(self.task)
        self.raw = dict(
            schema_version="ava-reconstruct-input-7",
            profile_id=self.task.profile_id,
            source_sha256=self.task.source_sha256,
            source_feature_policy="ava-ocr-source-features-1",
            source_layout_policy="ava-native-layout-1",
            source_structure_policy="ava-native-structure-1",
            source_normalization_policy="ava-native-word-wrap-1",
            recognition_repair_policy="ava-recognition-geometry-repair-1",
            source_title_policy="ava-frontmatter-title-1",
            responses=[],
            native_structure_responses=[],
            word_wrap_responses=[],
            geometry_corrections=[],
            refinements=[],
        )

    def test_empty_initial_and_complete_receipts_keep_input7(self):
        request = initial_input(json.dumps(dict(mode="attempt_stream", input=self.raw)).encode())
        self.assertIsInstance(request, FrontmatterTitleReconstructionInput)
        complete = attempt_complete_input(request, [], [self.response.model_dump(mode="json")])
        self.assertEqual("ava-reconstruct-input-7", complete.schema_version)
        self.assertEqual([self.response], complete.refinements)
        self.assertEqual("ava-frontmatter-title-1", complete.source_title_policy)

    def test_initial_prior_title_missing_policy_and_foreign_fields_refuse(self):
        for raw in (
            {**self.raw, "refinements": [self.response.model_dump(mode="json")]},
            {k: v for k, v in self.raw.items() if k != "source_title_policy"},
            {**self.raw, "source_title_policy": "foreign"},
            {**self.raw, "unknown": True},
        ):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                initial_input(json.dumps(dict(mode="attempt_stream", input=raw)).encode())

    def test_historical_inputs_remain_closed_to_title2(self):
        raw = {**self.raw, "refinements": [self.response.model_dump(mode="json")]}
        del raw["source_title_policy"]
        removals = {
            5: ["recognition_repair_policy", "geometry_corrections"],
            4: ["source_normalization_policy", "word_wrap_responses"],
            3: ["source_structure_policy", "native_structure_responses"],
            2: ["source_layout_policy"],
        }
        for version in range(6, 0, -1):
            for field in removals.get(version, []):
                raw.pop(field, None)
            with self.subTest(version=version), self.assertRaises(ValueError):
                reconstruction_input({**raw, "schema_version": f"ava-reconstruct-input-{version}"})

    def test_new_batch_and_input_exclude_title1_and_duplicate_title2(self):
        old, _, _, _ = title_fixture(self.scratch)
        batch = dict(
            schema_version="ava-book-refinement-batch-3",
            source_sha256=self.task.source_sha256,
            source_title_policy="ava-frontmatter-title-1",
        )
        for tasks in ([old], [self.task, self.task]):
            with self.assertRaises(ValueError):
                FrontmatterTitleRefinementBatch.model_validate({**batch, "tasks": tasks})
        for receipts in ([title_response(old)], [self.response, self.response]):
            with self.assertRaises(ValueError):
                reconstruction_input({**self.raw, "refinements": receipts})

    def test_sparse_reconstruction_does_not_downgrade_title2_to_input5(self):
        assembly = Mock()
        prefix = "ava_pdf_epub.reconstruction_v2.word_wrap_reconstruct."
        with (
            patch(
                prefix + "prepare_word_wrap_from_pages", return_value=(None, assembly, [])
            ) as prepare,
            patch(prefix + "apply_word_wrap", return_value={}),
            patch(prefix + "project_word_wrap_positions"),
        ):
            result = reconstruct_word_wrap_assembly(
                self.scratch / "source.pdf",
                self.scratch,
                list(self.pages.values()),
                [],
                [self.response],
                [],
                "ava-native-layout-1",
                "ava-native-word-wrap-1",
                [],
                source_title_policy="ava-frontmatter-title-1",
            )
        self.assertIs(result, assembly)
        request = prepare.call_args.args[3]
        self.assertIsInstance(request, FrontmatterTitleReconstructionInput)
        self.assertEqual([self.response], request.refinements)
        self.assertEqual("ava-frontmatter-title-1", request.source_title_policy)
