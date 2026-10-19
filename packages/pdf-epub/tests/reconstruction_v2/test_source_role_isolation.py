"""Historical input fields stay closed; current decisions stay finite and source-bound."""

import tempfile
import unittest
from pathlib import Path

from pydantic import TypeAdapter, ValidationError

from ava_pdf_epub.reconstruction_v2.page_checkpoints import PreparedPageMap
from ava_pdf_epub.reconstruction_v2.protocol import (
    PrintedTitleReconstructionInput,
    ReconstructionInput,
)
from ava_pdf_epub.reconstruction_v2.protocol_cell_geometry import CellGeometryReconstructionInput
from ava_pdf_epub.reconstruction_v2.protocol_continuation import ContinuationReconstructionInput
from ava_pdf_epub.reconstruction_v2.protocol_frontmatter_title import (
    FrontmatterTitleReconstructionInput,
)
from ava_pdf_epub.reconstruction_v2.protocol_native_layout import NativeLayoutReconstructionInput
from ava_pdf_epub.reconstruction_v2.protocol_native_structure import (
    NativeStructureReconstructionInput,
)
from ava_pdf_epub.reconstruction_v2.protocol_native_structure_v2 import (
    NativeStructure2ReconstructionInput,
)
from ava_pdf_epub.reconstruction_v2.protocol_native_word_wrap import (
    NativeWordWrapReconstructionInput,
)
from ava_pdf_epub.reconstruction_v2.protocol_recognition_geometry import (
    RecognitionGeometryReconstructionInput,
)
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal
from ava_pdf_epub.reconstruction_v2.source_role_tasks import source_role_tasks

from .source_role_fixture import role_case, role_response


class SourceRoleIsolationTests(unittest.TestCase):
    def test_all_historical_response_fields_reject_new_role_authority(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, _, _, task = role_case(Path(directory))
            response = role_response(task).model_dump(mode="json")
            old = [
                ReconstructionInput,
                PrintedTitleReconstructionInput,
                NativeLayoutReconstructionInput,
                NativeStructureReconstructionInput,
                NativeWordWrapReconstructionInput,
                RecognitionGeometryReconstructionInput,
                FrontmatterTitleReconstructionInput,
                NativeStructure2ReconstructionInput,
                CellGeometryReconstructionInput,
            ]
            for model in old:
                with self.subTest(model=model.__name__), self.assertRaises(ValidationError):
                    TypeAdapter(model.model_fields["refinements"].annotation).validate_python(
                        [response]
                    )
            self.assertEqual(
                1,
                len(
                    TypeAdapter(
                        ContinuationReconstructionInput.model_fields["refinements"].annotation
                    ).validate_python([response])
                ),
            )

    def test_25th_essential_owner_cannot_be_dropped_and_wrong_source_refuses(self):
        with tempfile.TemporaryDirectory() as directory:
            _, page, owner, state, task = role_case(Path(directory))
            owners = [owner.model_copy(update={"id": f"owner-{i}"}) for i in range(25)]
            with self.assertRaises(SourceContentRefusal):
                source_role_tasks(
                    page.source_sha256,
                    task.observation_sha256,
                    Path(directory),
                    PreparedPageMap([page]),
                    owners,
                    state,
                    0,
                )
            with self.assertRaises(SourceContentRefusal):
                source_role_tasks(
                    "b" * 64,
                    task.observation_sha256,
                    Path(directory),
                    PreparedPageMap([page]),
                    [owner],
                    state,
                    0,
                )
