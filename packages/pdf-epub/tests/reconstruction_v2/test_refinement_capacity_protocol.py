"""Current list fields allow64 while historical batch authority stays at32."""

import tempfile
import unittest
from pathlib import Path

from pydantic import TypeAdapter, ValidationError

from ava_pdf_epub.reconstruction_v2.protocol_continuation import (
    ContinuationReconstructionInput,
    ContinuationRefinementBatch,
)
from ava_pdf_epub.reconstruction_v2.protocol_frontmatter_title import (
    FrontmatterTitleRefinementBatch,
)

from .source_role_fixture import role_case, role_response


class RefinementCapacityProtocolTests(unittest.TestCase):
    def test_current_input_and_batch_retain64_and_refuse65(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, _, _, task = role_case(Path(directory))
            for model, field, item in [
                (ContinuationReconstructionInput, "refinements", role_response(task)),
                (ContinuationRefinementBatch, "tasks", task),
            ]:
                adapter = TypeAdapter(model.model_fields[field].rebuild_annotation())
                self.assertEqual(64, len(adapter.validate_python([item] * 64)))
                with self.assertRaises(ValidationError):
                    adapter.validate_python([item] * 65)
            self.assertEqual(
                32,
                FrontmatterTitleRefinementBatch.model_json_schema()["properties"]["tasks"][
                    "maxItems"
                ],
            )
