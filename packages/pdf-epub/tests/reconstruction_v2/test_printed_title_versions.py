"""A new aggregate authority must not reinterpret historical tasks, receipts or input bytes."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.attempt_stream import _input
from ava_pdf_epub.reconstruction_v2.protocol import (
    PrintedTitleReconstructionInput,
    ReconstructionInput,
    reconstruction_input,
)
from ava_pdf_epub.reconstruction_v2.refinement_contract import (
    PrintedTitleRefinementBatch,
    RefinementBatch,
)

from .printed_title_fixture import title_fixture, title_response


class PrintedTitleVersionsTests(unittest.TestCase):
    def test_title_task_and_receipt_require_the_new_conditional_aggregates(self):
        with tempfile.TemporaryDirectory() as directory:
            task, _, _, _ = title_fixture(Path(directory))
            receipt = title_response(task, None)
            old = ReconstructionInput(
                schema_version="ava-reconstruct-input-1",
                source_sha256=task.source_sha256,
                responses=[],
            )
            for schema in ["ava-reconstruct-input-1", "ava-reconstruct-input-2"]:
                raw = dict(
                    schema_version=schema,
                    source_sha256=task.source_sha256,
                    responses=[],
                    refinements=[receipt.model_dump(mode="json")],
                )
                if schema.endswith("-1"):
                    with self.assertRaises(ValueError):
                        reconstruction_input(raw)
                else:
                    self.assertIsInstance(
                        reconstruction_input(raw), PrintedTitleReconstructionInput
                    )
            self.assertEqual("ava-reconstruct-input-1", _input(old, [], []).schema_version)
            self.assertEqual(
                "ava-reconstruct-input-2",
                _input(old, [], [receipt.model_dump(mode="json")]).schema_version,
            )
            with self.assertRaises(ValueError):
                RefinementBatch(
                    schema_version="ava-book-refinement-batch-1",
                    source_sha256=task.source_sha256,
                    tasks=[task],
                )
            self.assertEqual(
                "ava-book-refinement-batch-2",
                PrintedTitleRefinementBatch(
                    schema_version="ava-book-refinement-batch-2",
                    source_sha256=task.source_sha256,
                    tasks=[task],
                ).schema_version,
            )

    def test_new_aggregates_cannot_claim_authority_without_exactly_one_title_task_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            task, _, _, _ = title_fixture(Path(directory))
            for tasks in [[], [task, task]]:
                with self.assertRaises(ValueError):
                    PrintedTitleRefinementBatch(
                        schema_version="ava-book-refinement-batch-2",
                        source_sha256=task.source_sha256,
                        tasks=tasks,
                    )
            for receipts in [[], [title_response(task), title_response(task)]]:
                with self.assertRaises(ValueError):
                    PrintedTitleReconstructionInput(
                        schema_version="ava-reconstruct-input-2",
                        source_sha256=task.source_sha256,
                        responses=[],
                        refinements=receipts,
                    )
